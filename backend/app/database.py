# ---- db.py ----

import sqlite3
from pathlib import Path
import googlemaps
from datetime import datetime, timedelta
import os
import json
from typing import Optional, Dict, List, Tuple, Any
import re
import time
import random
import click # For Flask CLI commands
from flask.cli import with_appcontext

try:
    from flask_bcrypt import generate_password_hash
except ImportError:
    print("Warning: Flask-Bcrypt not installed. Hashing will fail.")
    def generate_password_hash(pwd): return f"hashed_{pwd}".encode('utf-8')

from flask import current_app, g # Import Flask g and current_app

# --- Configuration ---
DATABASE = Path(__file__).parent / "carpool.db"
QUIZZES_JSON_PATH = Path(__file__).parent / "quizzes.json"
DB_TIMEOUT = 20.0  # Timeout in seconds for lock waits
MAX_RETRIES = 5   # Maximum number of retries for lock errors
RETRY_BACKOFF = 0.1 # Initial backoff time in seconds

# --- Flask Database Connection Management ---

def get_db():
    """
    Gets or creates a database connection for the current application context.
    Stores the connection in Flask's 'g' object.
    Enables WAL mode for better concurrency.
    """
    if 'db' not in g:
        try:
            db_path_str = current_app.config.get('DATABASE', str(DATABASE))
            # print(f"Creating new DB connection for request to {db_path_str}") # Optional debug
            g.db = sqlite3.connect(
                db_path_str,
                timeout=DB_TIMEOUT,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            g.db.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrency
            g.db.execute("PRAGMA journal_mode=WAL;")
            g.db.execute("PRAGMA foreign_keys = ON;")
        except sqlite3.Error as e:
            print(f"FATAL: Could not connect to database {db_path_str}: {e}")
            raise
    return g.db

def close_db(e=None):
    """
    Closes the database connection at the end of the request.
    Called automatically via app.teardown_appcontext.
    Commits if no exception occurred, otherwise rolls back.
    """
    db = g.pop('db', None)
    if db is not None:
        if e is None:
            try:
                # print("Committing DB transaction.") # Optional debug
                db.commit()
            except sqlite3.Error as commit_e:
                print(f"Error committing transaction: {commit_e}")
                try: db.rollback() # Rollback if commit fails
                except sqlite3.Error as rb_e: print(f"Error rolling back after failed commit: {rb_e}")
        else:
            try:
                # print(f"Rolling back DB transaction due to exception: {e}") # Optional debug
                db.rollback()
            except sqlite3.Error as rollback_e:
                print(f"Error rolling back transaction: {rollback_e}")
        try:
            # print("Closing DB connection.") # Optional debug
            db.close()
        except sqlite3.Error as close_e:
             print(f"Error closing database connection: {close_e}")

def execute_with_retry(conn, query, params=(), max_retries=MAX_RETRIES, initial_backoff=RETRY_BACKOFF):
    """
    Execute a query with retry logic ONLY for 'database is locked' errors.
    """
    backoff = initial_backoff
    retries = 0
    while True:
        try:
            cursor = conn.execute(query, params)
            return cursor
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and retries < max_retries:
                retries += 1
                sleep_time = backoff * (1 + random.uniform(0.1, 0.5))
                print(f"Database locked on query: {query[:50]}... Retrying ({retries}/{max_retries}) after {sleep_time:.2f}s...")
                time.sleep(sleep_time)
                backoff *= 2
            else:
                print(f"Database OperationalError (not retrying or retries exhausted): {e} on query: {query}")
                raise
        except sqlite3.Error as e:
            print(f"Database Error (not OperationalError/lock): {e} on query: {query}")
            raise

# --- Database Initialization ---

def init_db():
    """Initializes the database schema, creating tables only if they don't exist."""
    db_path_str = current_app.config.get('DATABASE', str(DATABASE))
    print(f"Ensuring database exists at: {db_path_str}")
    # Ensure the directory exists
    Path(db_path_str).parent.mkdir(parents=True, exist_ok=True)
    db = None
    try:
        # Use a dedicated connection, not from 'g'
        db = sqlite3.connect(db_path_str, timeout=DB_TIMEOUT, detect_types=sqlite3.PARSE_DECLTYPES)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL;")
        db.execute("PRAGMA foreign_keys = ON;")

        print("Ensuring tables exist...")
        db.execute("BEGIN;")

        # Create users table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        
        # Create users info table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS user_info (
                user_id INTEGER PRIMARY KEY,
                given_name TEXT,
                surname TEXT,
                birth_date TEXT,
                home_address TEXT,
                sex TEXT,
                misc_user_data TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        # Create carpool table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS carpool_list (
                carpool_id INTEGER PRIMARY KEY AUTOINCREMENT,
                driver_id INTEGER,
                route_origin TEXT,  -- Driver Origin Address
                route_destination TEXT, -- Driver Destination Address
                arrive_by TEXT, -- Latest Time Driver Can Arrive At Destination
                leave_earliest TEXT, -- Earliest Time Driver Can Leave Origin
                vehicle_license_plate TEXT, -- License Plate of Vehicle Driver Will Be Using
                carpool_capacity INTEGER, -- Max Amount of Passengers
                misc_data TEXT, -- JSON String Storing Other Information About Carpool
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (driver_id) REFERENCES users(id)          
            )
        ''')
        
        # Create carpool passengers table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS carpool_passengers (
                carpool_id INTEGER,
                passenger_id INTEGER,
                pickup_location TEXT,
                pickup_time TEXT,
                dropoff_location TEXT,
                dropoff_time TEXT,
                misc_data TEXT, -- JSON String For Storing Misc Info About Passenger (relevant only to this carpool trip)
                PRIMARY KEY (carpool_id, passenger_id),
                FOREIGN KEY (carpool_id) REFERENCES carpool_list(carpool_id),
                FOREIGN KEY (passenger_id) REFERENCES users(id)
            )
        ''')
        
        # Create driver info table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS driver_info (
                driver_id INTEGER PRIMARY KEY,
                dln TEXT, -- Drivers License Number
                license_expiration TEXT, -- license expiration date
                licensed_state TEXT, -- State Driver Is Licensed To Drive In
                misc_data TEXT, -- catch-all for other relevant driver info as JSON String
                FOREIGN KEY (driver_id) REFERENCES users(id)
            )
        ''')
        
        # Create car info table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS car_info (
                license_plate TEXT PRIMARY KEY, -- Car License Plate Number
                driver_id INTEGER,
                registered_state TEXT, -- the state where the car is registered
                make TEXT, -- Company who made the car
                model TEXT, -- Model of the car 
                year INTEGER, -- Year of the car
                max_capacity INTEGER, -- the number of people who can fit including driver
                misc_data TEXT, -- catch all field for misc car info as JSON string
                FOREIGN KEY (driver_id) REFERENCES users(id)                
            )
        ''')

        # Create quizzes table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS quizzes (
                quiz_id TEXT PRIMARY KEY,
                json TEXT NOT NULL, -- Store as JSON text
                return_address TEXT NOT NULL
            )
        ''')

        db.commit()
        print("Database schema ensured successfully.")

        # Optionally update quizzes if the table was just created or needs refreshing
        print("Checking quizzes data...")
        update_quiz_db()

    except sqlite3.Error as e:
        print(f"Error initializing database: {e}")
        if db:
            db.rollback()
        raise
    finally:
        if db:
            db.close()

@click.command('init-db')
@with_appcontext
def init_db_command():
    """Ensure database tables exist and populate quizzes."""
    try:
        init_db()
        click.echo('Ensured database tables exist.')
        click.echo('Quizzes data checked/updated.')
    except Exception as e:
        click.echo(f'Error during database initialization: {e}', err=True)
        import sys
        sys.exit(1)

# --- Application Integration ---

def init_app(app):
    """Register database functions with the Flask app and initialize DB on startup."""
    app.config.setdefault('DATABASE', str(DATABASE))  # Set default if not configured
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    with app.app_context():
        print("Running database initialization on server startup...")
        init_db()  # Automatically initialize database when app starts

# --- User Functions ---

def create_user(username: str, email: str, password: str) -> Optional[int]:
    """Create a new user."""
    password_hash = generate_password_hash(password).decode('utf-8')

    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        user_id = cursor.lastrowid
        
            
        # Rely on close_db teardown to commit
        return user_id
    except sqlite3.IntegrityError:
        print(f"Integrity error creating user '{username}'/'{email}'. User likely exists.")
        # Rely on close_db teardown to rollback
        return None
    except sqlite3.Error as e:
        print(f"Error creating user {username}: {e}")
        return None # Rely on close_db teardown to rollback

def get_user_by_username(username: str) -> Optional[Dict]:
    """Retrieve a user by username, including password hash for login checks."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        if user:
            return dict(user)
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by username {username}: {e}")
        return None

def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Retrieve user public data by ID."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            (user_id,)
        )
        user = cursor.fetchone()
        if user:
            return dict(user)
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by ID {user_id}: {e}")
        return None

def get_user_by_email(email: str) -> Optional[Dict]:
    """Retrieve user public data by email."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, created_at FROM users WHERE email = ?',
            (email,)
        )
        user = cursor.fetchone()
        if user:
            return dict(user)
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by email {email}: {e}")
        return None

# --- Carpool Functions ---

def reserve_carpool_listing_id(driver_id: int) -> Optional[int]:
    """Create a new carpool listing with just the driver_id field.
    
    Args:
        driver_id: The user ID of the driver
        
    Returns:
        The new carpool_id if successful, None otherwise
    """
    conn = get_db()
    try:
        # First, clean up stale carpool listings (where route_origin is NULL and created more than 1 hour ago)
        one_hour_ago = datetime.now() - timedelta(hours=1)
        one_hour_ago_str = one_hour_ago.strftime('%Y-%m-%d %H:%M:%S')
        
        cleanup_query = '''
            DELETE FROM carpool_list 
            WHERE (route_origin IS NULL OR route_origin = '') 
            AND created_at < ?
        '''
        
        cleanup_cursor = execute_with_retry(
            conn,
            cleanup_query,
            (one_hour_ago_str,)
        )
        
        if cleanup_cursor.rowcount > 0:
            print(f"Cleaned up {cleanup_cursor.rowcount} stale carpool listings")
        
        # Then proceed with creating the new carpool listing
        cursor = execute_with_retry(
            conn,
            'INSERT INTO carpool_list (driver_id) VALUES (?)',
            (driver_id,)
        )
        carpool_id = cursor.lastrowid
        
        # Rely on close_db teardown to commit
        return carpool_id
    except sqlite3.Error as e:
        print(f"Error creating carpool listing for driver ID {driver_id}: {e}")
        return None # Rely on close_db teardown to rollback

def get_carpool_listing(carpool_id: int, filters: Dict = None) -> Optional[Dict]:
    """
    Get detailed information about a specific carpool listing.
    
    Args:
        carpool_id: ID of the carpool to retrieve
        filters: Optional filters for route calculation
            
    Returns:
        Dictionary containing carpool details or None if not found
    """
    db = get_db()
    try:
        # Get the carpool from the database
        query = '''
            SELECT 
                cl.carpool_id, cl.driver_id, cl.route_origin, cl.route_destination, 
                cl.arrive_by, cl.leave_earliest, cl.carpool_capacity, cl.misc_data,
                cl.created_at, cl.vehicle_license_plate,
                u.username as driver_username,
                ui.given_name, ui.surname,
                ci.make, ci.model, ci.year, ci.max_capacity, ci.license_plate
            FROM carpool_list cl
            JOIN users u ON cl.driver_id = u.id
            LEFT JOIN user_info ui ON cl.driver_id = ui.user_id
            LEFT JOIN car_info ci ON cl.vehicle_license_plate = ci.license_plate
            WHERE cl.carpool_id = ?
              AND cl.route_origin IS NOT NULL 
              AND cl.route_destination IS NOT NULL
              AND cl.route_origin != ''
              AND cl.route_destination != ''
        '''
        
        row = db.execute(query, (carpool_id,)).fetchone()
        
        if not row:
            return None
            
        # Get passenger information for this carpool
        passengers_query = '''
            SELECT 
                cp.passenger_id, cp.pickup_location, cp.pickup_time, 
                cp.dropoff_location, cp.dropoff_time, cp.misc_data,
                u.username, ui.given_name, ui.surname
            FROM carpool_passengers cp
            JOIN users u ON cp.passenger_id = u.id
            LEFT JOIN user_info ui ON cp.passenger_id = ui.user_id
            WHERE cp.carpool_id = ?
        '''
        passengers = []
        passenger_rows = db.execute(passengers_query, (carpool_id,)).fetchall()
        
        for passenger_row in passenger_rows:
            passenger_dict = dict(passenger_row)
            
            # Process any JSON misc_data for passenger
            if passenger_dict.get('misc_data'):
                try:
                    misc_data = json.loads(passenger_dict['misc_data'])
                    passenger_dict.update(misc_data)
                    passenger_dict.pop('misc_data', None)
                except json.JSONDecodeError:
                    pass
            
            # Format full name
            passenger_dict['full_name'] = f"{passenger_dict.get('given_name', '')} {passenger_dict.get('surname', '')}".strip()
            if not passenger_dict['full_name']:
                passenger_dict['full_name'] = passenger_dict['username']
            
            passengers.append(passenger_dict)
        
        # Get total passenger count
        passenger_count = len(passengers)
        
        # Parse any JSON data stored in misc_data
        misc_data = {}
        if row['misc_data']:
            try:
                misc_data = json.loads(row['misc_data'])
            except json.JSONDecodeError:
                misc_data = {}
        
        carpool = {
            'carpool_id': row['carpool_id'],
            'driver': {
                'id': row['driver_id'],
                'username': row['driver_username'],
                'given_name': row['given_name'] or '',
                'surname': row['surname'] or '',
                'full_name': f"{row['given_name'] or ''} {row['surname'] or ''}".strip()
            },
            'route': {
                'origin': row['route_origin'],
                'destination': row['route_destination'],
                'arrive_by': row['arrive_by'],
                'leave_earliest': row['leave_earliest']
            },
            'vehicle': {
                'make': row['make'] or '',
                'model': row['model'] or '',
                'year': row['year'] or '',
                'license_plate': row['license_plate'] or '',
                'full_description': f"{row['year'] or ''} {row['make'] or ''} {row['model'] or ''}".strip()
            },
            'capacity': {
                'max': row['max_capacity'] or row['carpool_capacity'] or 0,
                'current': passenger_count
            },
            'passengers': passengers,
            'created_at': row['created_at'],
            'misc_data': misc_data
        }
        
        # Add route information if filters are provided
        if filters and (filters.get('pickup_location') or filters.get('dropoff_location')):
            route_info = get_route_information(carpool, filters)
            if route_info:
                carpool['route_info'] = route_info
        
        return carpool
            
    except sqlite3.Error as e:
        print(f"Error getting carpool listing: {e}")
        return None

def get_carpool_list(filters: Dict = None) -> List[Dict]:
    """
    Get available carpools with driver and car details based on optional filters.
    Excludes incomplete carpool listings (those without origin or destination).
    
    Args:
        filters: Optional dictionary containing filter criteria
            - pickup_location: User's pickup location
            - dropoff_location: User's dropoff location
            - arrival_date: Date of arrival at destination
            - min_seats: Minimum available seats
            - earliest_pickup: Earliest pickup time
            - latest_arrival: Latest arrival time
            
    Returns:
        List of carpools with driver, car, and passenger information that match filters
    """
    db = get_db()
    try:
        # Get all carpools from the carpool_list table
        query = '''
            SELECT carpool_id
            FROM carpool_list
            WHERE route_origin IS NOT NULL 
              AND route_destination IS NOT NULL
              AND route_origin != ''
              AND route_destination != ''
        '''
        
        # Apply additional filters if provided
        params = []
        if filters:
            # Filter by arrival date if provided
            if 'arrival_date' in filters and filters['arrival_date']:
                query += '''
                    AND (
                        substr(arrive_by, 7, 4) || '-' || 
                        substr(arrive_by, 1, 2) || '-' || 
                        substr(arrive_by, 4, 2) = ?
                    )
                '''
                params.append(filters['arrival_date'])
        
        # Execute the query
        carpool_ids = db.execute(query, params).fetchall()
        
        carpools = []
        for row in carpool_ids:
            carpool_id = row['carpool_id']
            carpool = get_carpool_listing(carpool_id, filters)
            
            if carpool:
                # Apply min_seats filter if provided
                if filters and 'min_seats' in filters and filters['min_seats']:
                    min_seats = int(filters['min_seats'])
                    carpool_capacity = carpool['capacity']['max']
                    current_passengers = carpool['capacity']['current']
                    
                    if (carpool_capacity - current_passengers) < min_seats:
                        # Skip this carpool if it doesn't have enough available seats
                        continue
                    
                # Skip carpools with arrival time in the past
                if 'route' in carpool and 'arrive_by' in carpool['route'] and carpool['route']['arrive_by']:
                    try:
                        # Parse the arrive_by time
                        arrive_by = carpool['route']['arrive_by']
                        
                        # Handle combined date-time format with semicolon
                        if ';' in arrive_by:
                            date_part, time_part = arrive_by.split(';')
                            # Convert to datetime object
                            arrive_datetime = datetime.strptime(f"{date_part} {time_part}", "%m-%d-%Y %H:%M")
                        else:
                            # If only time is provided, we need the travel date
                            if 'arrival_date' in filters and filters['arrival_date']:
                                arrival_date = filters['arrival_date']
                                arrive_datetime = datetime.strptime(f"{arrival_date} {arrive_by}", "%Y-%m-%d %H:%M")
                            else:
                                # If no travel date, assume today
                                today = datetime.now().strftime("%Y-%m-%d")
                                arrive_datetime = datetime.strptime(f"{today} {arrive_by}", "%Y-%m-%d %H:%M")
                        
                        # Skip if arrival time is in the past
                        if arrive_datetime < datetime.now():
                            continue
                    except ValueError as e:
                        print(f"Error parsing arrive_by time: {e}")
                
                carpools.append(carpool)
        
        return carpools
            
    except sqlite3.Error as e:
        print(f"Error getting carpool list: {e}")
        return []

def add_passenger_to_carpool(carpool_id: int, passenger_id: int, pickup_location: str, 
                            dropoff_location: str, filters: Dict = None) -> Dict:
    """
    Add a passenger to a carpool.
    
    Args:
        carpool_id: ID of the carpool
        passenger_id: ID of the user joining as passenger
        pickup_location: Passenger's pickup location
        dropoff_location: Passenger's dropoff location
        filters: Additional filter data for calculating route information
        
    Returns:
        Dictionary containing result information:
            - success: Boolean indicating if operation was successful
            - message: Descriptive message
            - carpool: Updated carpool information if successful
            - error: Error message if unsuccessful
    """
    db = get_db()
    
    try:
        # First check if the carpool exists and has available capacity
        carpool = get_carpool_listing(carpool_id, filters)
        
        if not carpool:
            return {
                'success': False,
                'error': 'Carpool not found',
                'message': 'The specified carpool does not exist.'
            }
        
        # Check if the passenger is already in this carpool
        check_query = "SELECT passenger_id FROM carpool_passengers WHERE carpool_id = ? AND passenger_id = ?"
        existing = db.execute(check_query, (carpool_id, passenger_id)).fetchone()
        
        if existing:
            return {
                'success': False,
                'error': 'already_joined',
                'message': 'You are already a passenger in this carpool.'
            }
        
        # Check if the passenger is the driver
        if carpool['driver']['id'] == passenger_id:
            return {
                'success': False,
                'error': 'driver_join_attempt',
                'message': 'You cannot join your own carpool as a passenger.'
            }
        
        # Check available capacity
        if carpool['capacity']['current'] >= carpool['capacity']['max']:
            return {
                'success': False,
                'error': 'carpool_full',
                'message': 'This carpool is already at full capacity.'
            }
        
        # Check route viability if route_info is available
        if 'route_info' in carpool and not carpool['route_info'].get('is_viable', True):
            return {
                'success': False,
                'error': 'route_not_viable',
                'message': 'This carpool route is not viable for your requirements.',
                'issues': carpool['route_info'].get('viability_issues', [])
            }
        
        # Extract timing information from route_info if available
        pickup_time = None
        dropoff_time = None
        
        if 'route_info' in carpool:
            pickup_time = carpool['route_info'].get('pickup_time')
            dropoff_time = carpool['route_info'].get('dropoff_time')
        
        # Add the passenger to the carpool
        insert_query = """
            INSERT INTO carpool_passengers (
                carpool_id, passenger_id, pickup_location, dropoff_location, 
                pickup_time, dropoff_time
            ) VALUES (?, ?, ?, ?, ?, ?)
        """
        
        db.execute(insert_query, (
            carpool_id, passenger_id, pickup_location, dropoff_location,
            pickup_time, dropoff_time
        ))
        
        db.commit()
        
        # Get the updated carpool information
        updated_carpool = get_carpool_listing(carpool_id, filters)
        
        return {
            'success': True,
            'message': 'Successfully joined the carpool.',
            'carpool': updated_carpool
        }
        
    except sqlite3.Error as e:
        db.rollback()
        print(f"Error adding passenger to carpool: {e}")
        return {
            'success': False,
            'error': 'database_error',
            'message': f'An error occurred while joining the carpool: {str(e)}'
        }

def get_passenger_details(carpool_id: int) -> List[Dict]:
    """Get all passengers for a carpool listing.
    
    Args:
        carpool_id: The ID of the carpool listing
        
    Returns:
        List of dictionaries with passenger details
    """
    conn = get_db()
    try:
        # First get all passengers with their basic details
        cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                cp.carpool_id, cp.passenger_id, cp.pickup_location, 
                cp.pickup_time, cp.dropoff_location, cp.dropoff_time, 
                cp.misc_data,
                u.username as passenger_name,
                ui.given_name || ' ' || ui.surname as full_name
            FROM carpool_passengers cp
            JOIN users u ON cp.passenger_id = u.id
            JOIN user_info ui ON cp.passenger_id = ui.user_id
            WHERE cp.carpool_id = ?
            ''',
            (carpool_id,)
        )
        
        passengers = []
        for row in cursor.fetchall():
            passenger_dict = dict(row)
            
            # Process misc_data if it exists
            if passenger_dict['misc_data']:
                try:
                    misc_data = json.loads(passenger_dict['misc_data'])
                    # Merge the misc_data into the main dict
                    passenger_dict.update(misc_data)
                except json.JSONDecodeError:
                    # If JSON is invalid, keep the raw string
                    pass
                    
            passengers.append(passenger_dict)
            
        return passengers
    except sqlite3.Error as e:
        print(f"Error getting passengers for carpool {carpool_id}: {e}")
        return []

def get_car_info(driver_id: int) -> Optional[Dict]:
    """Get car information for a driver.
    
    Args:
        driver_id: The user ID of the driver
        
    Returns:
        Dictionary with car details or None if not found
    """
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                license_plate, registered_state, make, model, 
                year, max_capacity, misc_data
            FROM car_info 
            WHERE driver_id = ?
            ''',
            (driver_id,)
        )
        
        car = cursor.fetchone()
        if not car:
            return None
            
        # Convert to dict for easier handling
        car_dict = dict(car)
        
        # Process misc_data if it exists
        if car_dict['misc_data']:
            try:
                misc_data = json.loads(car_dict['misc_data'])
                # Merge the misc_data into the main dict
                car_dict.update(misc_data)
            except json.JSONDecodeError:
                # If JSON is invalid, keep the raw string
                pass
                
        return car_dict
    except sqlite3.Error as e:
        print(f"Error getting car info for driver {driver_id}: {e}")
        return None

def get_full_carpool_details(carpool_id: int, user_id: int = None) -> Optional[Dict]:
    """Get full details for a carpool listing, including passengers and car info.
    
    Args:
        carpool_id: The ID of the carpool listing
        user_id: Optional user ID to verify ownership (if provided)
        
    Returns:
        Dictionary with carpool details including passengers or None if not found/authorized
    """
    conn = get_db()
    try:
        # First get the carpool with driver_id so we can look up car info
        cursor = execute_with_retry(
            conn,
            'SELECT driver_id FROM carpool_list WHERE carpool_id = ?',
            (carpool_id,)
        )
        
        carpool_row = cursor.fetchone()
        if not carpool_row:
            return None
            
        driver_id = carpool_row['driver_id']
        
        # Verify ownership if user_id provided
        if user_id is not None and driver_id != user_id:
            return get_public_carpool_details(carpool_id)
    
        # Get the basic carpool listing without driver_id
        carpool = get_carpool_listing(carpool_id)
        if not carpool:
            return None
            
        # Get passenger details
        passengers = get_passenger_details(carpool_id)
        
        # Add passengers to the carpool details
        carpool['passengers'] = passengers
        
        # Get car info for the driver
        car_info = get_car_info(driver_id)
        
        # Add car info to the carpool details
        carpool['car_info'] = car_info or {}
        
        return carpool
    except sqlite3.Error as e:
        print(f"Error getting full carpool details for {carpool_id}: {e}")
        return None

def get_public_passenger_details(carpool_id: int) -> List[Dict]:
    """Get limited passenger details for a carpool listing, excluding sensitive information.
    
    Args:
        carpool_id: The ID of the carpool listing
        
    Returns:
        List of dictionaries with limited passenger details (only ID and name)
    """
    conn = get_db()
    try:
        # Get passenger details with more fields to match the full listing format
        cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                cp.passenger_id,
                u.username,
                ui.given_name, 
                ui.surname,
                cp.pickup_location,
                cp.dropoff_location,
                cp.pickup_time,
                cp.dropoff_time
            FROM carpool_passengers cp
            JOIN users u ON cp.passenger_id = u.id
            LEFT JOIN user_info ui ON cp.passenger_id = ui.user_id
            WHERE cp.carpool_id = ?
            ''',
            (carpool_id,)
        )
        
        passengers = []
        for row in cursor.fetchall():
            passenger_dict = dict(row)
            
            # Format full name as in the full listing
            given_name = passenger_dict.get('given_name', '')
            surname = passenger_dict.get('surname', '')
            username = passenger_dict.get('username', '')
            
            full_name = f"{given_name} {surname}".strip()
            if not full_name:
                full_name = username
                
            passenger_dict['full_name'] = full_name
            
            passengers.append(passenger_dict)
            
        return passengers
    except sqlite3.Error as e:
        print(f"Error getting public passenger info for carpool {carpool_id}: {e}")
        return []

def get_public_carpool_details(carpool_id: int) -> Optional[Dict]:
    """Get public details for a carpool listing, including limited passenger info.
    
    Args:
        carpool_id: The ID of the carpool listing
        
    Returns:
        Dictionary with public carpool details or None if not found
    """
    conn = get_db()
    try:
        # First get the carpool with driver_id so we can look up car info
        cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                carpool_id, driver_id, route_origin, route_destination, 
                arrive_by, leave_earliest, carpool_capacity, 
                created_at
            FROM carpool_list 
            WHERE carpool_id = ?
            ''',
            (carpool_id,)
        )
        
        carpool_row = cursor.fetchone()
        if not carpool_row:
            return None
            
        # Convert to dict for easier handling
        carpool_base = dict(carpool_row)
        driver_id = carpool_base.pop('driver_id', None)
        
        # Get driver's username
        driver_cursor = execute_with_retry(
            conn,
            'SELECT username, id FROM users WHERE id = ?',
            (driver_id,)
        )
        driver_row = driver_cursor.fetchone()
        
        # Get driver info from user_info
        driver_info_cursor = execute_with_retry(
            conn,
            'SELECT given_name, surname FROM user_info WHERE user_id = ?',
            (driver_id,)
        )
        driver_info = driver_info_cursor.fetchone()
        
        # Get limited passenger details
        passengers = get_public_passenger_details(carpool_id)
        
        # Add passengers to the carpool details
        passenger_count = len(passengers) if passengers else 0
        
        # Get car info for the driver (excluding sensitive details)
        car_cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                make, model, year, max_capacity, license_plate
            FROM car_info 
            WHERE driver_id = ?
            ''',
            (driver_id,)
        )
        
        car = car_cursor.fetchone()
        car_info = dict(car) if car else {}
        
        # Structure the return data to match get_carpool_listing format
        carpool = {
            'carpool_id': carpool_base.get('carpool_id'),
            'driver': {
                'id': driver_id,
                'username': driver_row['username'] if driver_row else '',
                'given_name': driver_info['given_name'] if driver_info else '',
                'surname': driver_info['surname'] if driver_info else '',
                'full_name': f"{driver_info['given_name'] if driver_info and driver_info['given_name'] else ''} {driver_info['surname'] if driver_info and driver_info['surname'] else ''}".strip() if driver_info else ''
            },
            'route': {
                'origin': carpool_base.get('route_origin', ''),
                'destination': carpool_base.get('route_destination', ''),
                'arrive_by': carpool_base.get('arrive_by', ''),
                'leave_earliest': carpool_base.get('leave_earliest', '')
            },
            'vehicle': {
                'make': car_info.get('make', ''),
                'model': car_info.get('model', ''),
                'year': car_info.get('year', ''),
                'license_plate': car_info.get('license_plate', ''),
                'full_description': f"{car_info.get('year', '')} {car_info.get('make', '')} {car_info.get('model', '')}".strip()
            },
            'capacity': {
                'max': car_info.get('max_capacity', 0) or carpool_base.get('carpool_capacity', 0),
                'current': passenger_count
            },
            'passengers': passengers,
            'created_at': carpool_base.get('created_at', ''),
            'misc_data': {},
            'car_info': car_info
        }
        
        return carpool
    except sqlite3.Error as e:
        print(f"Error getting public carpool details for {carpool_id}: {e}")
        return None

# --- QUIZ FUNCTIONS (Universal ID Handling) ---

def parse_universal_id(universal_id: str) -> Dict:
    """Parse universal_id in the format:
    "DB_TABLE_NAME[KEY_COLUMN_NAME:VALUE_OF_KEY]@DATA_COLUMN_NAME->KEY_FOR_VALUE_IN_JSON_DICT"
    
    Also handles simple variable IDs like "<plate>"
    
    Args:
        universal_id: The universal_id string to parse
        
    Returns:
        Dict: A dictionary containing the parsed components
    """
    if not isinstance(universal_id, str): return None
    try:
        # Handle the case where the universal_id is just a variable reference
        if universal_id.startswith('<') and universal_id.endswith('>'):
            variable_name = universal_id[1:-1]
            return {
                'is_variable': True,
                'variable_name': variable_name
            }
        
        # Parse the table and row identifier section
        table_match = re.match(r'([^[]+)\[([^:]+):([^\]]+)\]@([^->]+)(->(.+))?', universal_id)
        
        if not table_match:
            raise ValueError(f"Invalid universal_id format: {universal_id}")
            
        table_name = table_match.group(1)
        key_column = table_match.group(2)
        key_value = table_match.group(3)
        data_column = table_match.group(4)
        json_key = table_match.group(6)  # This will be None if -> is not present
        
        return {
            'is_variable': False,
            'table_name': table_name,
            'key_column': key_column,
            'key_value': key_value,
            'data_column': data_column,
            'json_key': json_key
        }
    except Exception as e:
        print(f"Error parsing universal_id '{universal_id}': {e}")
        return None

def get_options_from_universal_id(universal_id: str, context: Dict) -> List[str]:
    """
    Retrieves a list of options from the database based on a universal_id format.
    For example, if the universal_id is 'car_info[driver_id:<user_id>]@license_plate',
    it will return a list of all license plates for the given driver_id.
    
    Args:
        universal_id: The universal_id to parse and use for querying
        context: Dictionary containing values for variables
        
    Returns:
        List of options retrieved from the database
    """
    parsed = parse_universal_id(universal_id)
    if not parsed: 
        print(f"Failed to parse universal_id for options: {universal_id}")
        return []
        
    # Handle variable-only universal ID (e.g., <plate>)
    if parsed.get('is_variable', False):
        variable_name = parsed['variable_name']
        # First check if the variable exists in g
        if hasattr(g, variable_name) and getattr(g, variable_name) is not None:
            return [str(getattr(g, variable_name))]
        # Then check if it exists in context
        if variable_name in context:
            return [str(context[variable_name])]
        # Variable not found
        return []

    # Replace context variables in key_value
    key_value = _substitute_context(parsed['key_value'], context)
    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
        print(f"Warning: Context variable {parsed['key_value']} not found for options UID {universal_id}")
        return []

    conn = get_db()
    try:
        # Query to get all matching rows and extract the specified column values
        query = f"SELECT \"{parsed['data_column']}\" FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
        cursor = execute_with_retry(conn, query, (key_value,))
        
        options = []
        for row in cursor.fetchall():
            column_value = row[parsed['data_column']]
            
            # If there's a JSON key path, extract the value from the JSON
            if parsed['json_key'] and column_value is not None:
                try:
                    json_data = {}
                    if isinstance(column_value, (dict, list)): 
                        json_data = column_value
                    elif isinstance(column_value, str) and column_value.strip(): 
                        json_data = json.loads(column_value)

                    keys = parsed['json_key'].split('.')
                    data = json_data
                    for key in keys:
                        if isinstance(data, dict): 
                            data = data.get(key)
                        else: 
                            data = None
                            break
                    
                    if data is not None:
                        options.append(str(data))
                except (json.JSONDecodeError, TypeError) as json_e:
                    print(f"Error decoding JSON for options UID {universal_id} (key: {parsed['json_key']}): {json_e}")
            else:
                # Add the column value directly if it's not None
                if column_value is not None:
                    options.append(str(column_value))
        
        return options
    except sqlite3.Error as e:
        print(f"Database error retrieving options for UID {universal_id}: {e}")
        return []

# Function for substituting values of variables fed in context into the universal id
def _substitute_context(text: str, context: Optional[Dict], empty_string_if_not_found: bool = False) -> str:
    """Substitute <variable> placeholders in text using context and Flask g.
    
    This can be used for substituting variables in any text string including 
    key_value in universal IDs, return_address in quizzes, etc.
    
    Args:
        text: The text containing <variable> placeholders
        context: Dictionary containing values for variables
        empty_string_if_not_found: If True, return an empty string when a variable is not found
        
    Returns:
        String with placeholders replaced by values
    """
    if not context or not isinstance(text, str):
        return str(text)
        
    # If it's a complete variable reference (entire string is a variable)
    if text.startswith('<') and text.endswith('>'):
        var_name = text[1:-1]
        
        # Check if this is an answer reference pattern <answer:qX>
        answer_match = re.match(r'answer:([a-zA-Z0-9_]+)', var_name)
        if answer_match:
            question_id = answer_match.group(1)
            # Look for the answer in context under 'answers' or 'quiz_answers'
            answers = context.get('answers', {}) or context.get('quiz_answers', {})
            if question_id in answers:
                return str(answers[question_id])
            print(f"Warning: Answer for question {question_id} not found in context")
            return "" if empty_string_if_not_found else text
            
        # if the variable is not an answer, check if it exists in g or context
        val_from_g = g.get(var_name)
        if val_from_g is not None:
             return str(val_from_g)
        val_from_context = context.get(var_name)
        if val_from_context is not None:
            return str(val_from_context)
        return "" if empty_string_if_not_found else text
    
    # For embedded variable references within a longer string
    def substitute_refs(match):
        var_ref = match.group(0)  # The entire match including <>
        var_name = var_ref[1:-1]  # Remove < and >
        
        # Handle answer references
        answer_match = re.match(r'answer:([a-zA-Z0-9_]+)', var_name)
        if answer_match:
            question_id = answer_match.group(1)
            answers = context.get('answers', {}) or context.get('quiz_answers', {})
            if question_id in answers:
                return str(answers[question_id])
            print(f"Warning: Answer for question {question_id} not found in context")
            return "" if empty_string_if_not_found else var_ref
        
        # Handle other variables
        val_from_g = g.get(var_name)
        if val_from_g is not None:
            return str(val_from_g)
        val_from_context = context.get(var_name)
        if val_from_context is not None:
            return str(val_from_context)
        return "" if empty_string_if_not_found else var_ref
    
    # Apply substitution to any <var> pattern in the text
    pattern = r'<[^>]+>'
    result = re.sub(pattern, substitute_refs, text)
    return result

def get_data_for_universal_id(universal_id: str, context: Dict) -> Any:
    """Retrieve data for a given universal_id using context."""
    parsed = parse_universal_id(universal_id)
    if not parsed: return ""
    
    # Handle variable-only universal ID (e.g., <plate>)
    if parsed.get('is_variable', False):
        variable_name = parsed['variable_name']
        # First check if the variable exists in g
        if hasattr(g, variable_name) and getattr(g, variable_name) is not None:
            return getattr(g, variable_name)
        # Then check if it exists in context
        if variable_name in context:
            return context[variable_name]
        # Variable not found
        return ""

    key_value = _substitute_context(parsed['key_value'], context)
    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
        print(f"Warning: Context variable {parsed['key_value']} not found for UID {universal_id}")
        return ""

    conn = get_db()
    try:
        query = f"SELECT \"{parsed['data_column']}\" FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
        cursor = execute_with_retry(conn, query, (key_value,))
        row = cursor.fetchone()
        if not row: return ""

        column_value = row[parsed['data_column']]

        if parsed['json_key'] and column_value is not None:
            try:
                json_data = {}
                if isinstance(column_value, (dict, list)): json_data = column_value
                elif isinstance(column_value, str) and column_value.strip(): json_data = json.loads(column_value)

                keys = parsed['json_key'].split('.')
                data = json_data
                for key in keys:
                    if isinstance(data, dict): data = data.get(key)
                    else: data = None; break
                return data if data is not None else ""
            except (json.JSONDecodeError, TypeError) as json_e:
                print(f"Error decoding JSON for UID {universal_id} (key: {parsed['json_key']}): {json_e}")
                return ""
        else:
            return column_value if column_value is not None else ""
    except sqlite3.Error as e:
        print(f"Database error retrieving data for UID {universal_id}: {e}")
        return ""

def save_data_for_universal_id(universal_id: str, value: Any, context: Dict) -> bool:
    """Save data for a given universal_id using context."""
    parsed = parse_universal_id(universal_id)
    if not parsed: return False
    
    # Handle variable-only universal ID (e.g., <plate>)
    if parsed.get('is_variable', False):
        variable_name = parsed['variable_name']
        # Update context with the new value
        context[variable_name] = value
        try:
            setattr(g, variable_name, value)
        except RuntimeError:
            # Not in a Flask request context
            pass
        print(f"Updated context with {variable_name}={value}")
        return True

    key_value = _substitute_context(parsed['key_value'], context)
    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
         print(f"Warning: Context variable {parsed['key_value']} not found for saving UID {universal_id}")
         return False

    conn = get_db()
    try:
        # --- Logic for JSON key update ---
        if parsed['json_key']:
            select_query = f"SELECT \"{parsed['data_column']}\" FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
            cursor = execute_with_retry(conn, select_query, (key_value,))
            row = cursor.fetchone()
            json_data = {}
            row_exists = row is not None
            if row_exists and row[parsed['data_column']] is not None:
                current_data = row[parsed['data_column']]
                if isinstance(current_data, str) and current_data.strip():
                    try: json_data = json.loads(current_data)
                    except (json.JSONDecodeError, TypeError): json_data = {}
                elif isinstance(current_data, dict): json_data = current_data

            keys = parsed['json_key'].split('.')
            target = json_data
            for i, key in enumerate(keys):
                if i == len(keys) - 1: target[key] = value
                else:
                    if key not in target or not isinstance(target[key], dict): target[key] = {}
                    target = target[key]
            updated_json_text = json.dumps(json_data)

            if row_exists:
                update_query = f"UPDATE \"{parsed['table_name']}\" SET \"{parsed['data_column']}\" = ? WHERE \"{parsed['key_column']}\" = ?"
                execute_with_retry(conn, update_query, (updated_json_text, key_value))
            else:
                print(f"Info: Row not found for UID {universal_id} key {key_value}. Inserting.")
                insert_query = f"INSERT INTO \"{parsed['table_name']}\" (\"{parsed['key_column']}\", \"{parsed['data_column']}\") VALUES (?, ?)"
                try: execute_with_retry(conn, insert_query, (key_value, updated_json_text))
                except sqlite3.Error as e: print(f"Error INSERTING new row for UID {universal_id}: {e}"); return False
            # Rely on close_db to commit

        # --- Logic for direct column update ---
        else:
            actual_value = json.dumps(value) if isinstance(value, (dict, list)) else value
            select_query = f"SELECT 1 FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
            cursor = execute_with_retry(conn, select_query, (key_value,))
            row_exists = cursor.fetchone() is not None

            if row_exists:
                update_query = f"UPDATE \"{parsed['table_name']}\" SET \"{parsed['data_column']}\" = ? WHERE \"{parsed['key_column']}\" = ?"
                execute_with_retry(conn, update_query, (actual_value, key_value))
            else:
                print(f"Info: Row not found for UID {universal_id} key {key_value}. Inserting.")
                insert_query = f"INSERT INTO \"{parsed['table_name']}\" (\"{parsed['key_column']}\", \"{parsed['data_column']}\") VALUES (?, ?)"
                try: execute_with_retry(conn, insert_query, (key_value, actual_value))
                except sqlite3.Error as e: print(f"Error INSERTING new row for UID {universal_id}: {e}"); return False

        return True
    except sqlite3.Error as e:
        print(f"Database error saving data for UID {universal_id}: {e}")
        return False # Rely on close_db to rollback

def update_quiz_db():
    """Update the quizzes table from quizzes.json file."""
    # Use constant path for quizzes JSON unless configured otherwise
    quiz_file = current_app.config.get('QUIZZES_JSON_PATH', QUIZZES_JSON_PATH)
    if not quiz_file.exists():
        print(f"Warning: Quizzes file not found at {quiz_file}. Cannot update quizzes.")
        return

    try:
        with open(quiz_file, 'r', encoding='utf-8') as f:
            quizzes_from_file = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"Error reading or parsing {quiz_file}: {e}")
        return

    conn = get_db()
    updated_count, inserted_count, deleted_count = 0, 0, 0
    try:
        cursor = execute_with_retry(conn, 'SELECT quiz_id FROM quizzes')
        existing_quiz_ids = {row['quiz_id'] for row in cursor.fetchall()}
        file_quiz_ids = set()

        for quiz_data in quizzes_from_file:
            quiz_id = quiz_data.get('id')
            if not quiz_id: continue
            file_quiz_ids.add(quiz_id)
            quiz_json_text = json.dumps(quiz_data)
            return_address = quiz_data.get('return_address', '/home')

            if quiz_id in existing_quiz_ids:
                execute_with_retry(conn,'UPDATE quizzes SET json = ?, return_address = ? WHERE quiz_id = ?',(quiz_json_text, return_address, quiz_id))
                updated_count += 1
            else:
                execute_with_retry(conn,'INSERT INTO quizzes (quiz_id, json, return_address) VALUES (?, ?, ?)',(quiz_id, quiz_json_text, return_address))
                inserted_count += 1

        ids_to_delete = existing_quiz_ids - file_quiz_ids
        if ids_to_delete:
            placeholders = ', '.join('?' for _ in ids_to_delete)
            execute_with_retry(conn, f"DELETE FROM quizzes WHERE quiz_id IN ({placeholders})", tuple(ids_to_delete))
            deleted_count = len(ids_to_delete)

        print(f"Quizzes DB update: {inserted_count} inserted, {updated_count} updated, {deleted_count} deleted.")
    except sqlite3.Error as e:
        print(f"Error updating quizzes database: {e}")

def get_quiz_by_id(quiz_id: str) -> Optional[Dict]:
    """Retrieve the full quiz data (as dict) for a given quiz ID."""
    conn = get_db()
    try:
        cursor = execute_with_retry(conn, 'SELECT quiz_id, json, return_address FROM quizzes WHERE quiz_id = ?', (quiz_id,))
        quiz = cursor.fetchone()
        return dict(quiz) if quiz else None
    except sqlite3.Error as e:
        print(f"Error getting quiz by ID {quiz_id}: {e}")
        return None

def get_user_data(user_id: int) -> Dict:
    """Retrieve and parse the misc_user_data JSON for a user from the user_info table."""
    conn = get_db()
    try:
        cursor = execute_with_retry(conn, 'SELECT misc_user_data FROM user_info WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        if row and row['misc_user_data']:
            try: 
                return json.loads(row['misc_user_data'])
            except (json.JSONDecodeError, TypeError): 
                return {}
        return {}
    except sqlite3.Error as e:
        print(f"Error getting misc_user_data for user ID {user_id}: {e}")
        return {}

def _evaluate_precondition(precondition: Dict, context: Dict) -> Tuple[bool, Optional[str]]:
    """Evaluate a precondition object and return if it passed and any failure message.
    
    Args:
        precondition: Dictionary containing value1, condition, value2, and optional failure_message
        context: Dictionary containing values for variables
        
    Returns:
        Tuple (passed, failure_message)
    """
    if not isinstance(precondition, dict):
        return False, "Invalid precondition format"
    
    # Check that required fields are present
    if not all(key in precondition for key in ['value1', 'condition', 'value2']):
        return False, "Precondition missing required fields"
    
    # Handle context substitution for value1 and value2
    value1 = precondition['value1']
    value2 = precondition['value2']
    
    # Handle universal_id format for value1
    if isinstance(value1, str) and re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', value1):
        # This is a universal_id, get its value from the database
        try:
            value1 = get_data_for_universal_id(value1, context)
        except Exception as e:
            print(f"Error getting data for universal_id in precondition: {e}")
            value1 = ""
    else:
        # Regular context substitution
        value1 = _substitute_context(str(value1), context, True)
        
    # Handle universal_id format for value2
    if isinstance(value2, str) and re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', value2):
        # This is a universal_id, get its value from the database
        try:
            value2 = get_data_for_universal_id(value2, context)
        except Exception as e:
            print(f"Error getting data for universal_id in precondition: {e}")
            value2 = ""
    else:
        # Regular context substitution
        value2 = _substitute_context(str(value2), context, True)  

    # Handle special NULL value
    if isinstance(value1, str) and value1.upper() == "NULL":
        value1 = None
    if isinstance(value2, str) and value2.upper() == "NULL":
        value2 = None
        
    if not value1:
        value1 = None
    if not value2:
        value2 = None
    
    # Get the condition operator
    condition = precondition['condition']
   
    # Evaluate the condition
    passed = False
    try:
        if condition == "==":
            passed = str(value1) == str(value2)
        elif condition == "!=":
            passed = str(value1) != str(value2)
        elif condition == ">":
            passed = float(value1) > float(value2)
        elif condition == "<":
            passed = float(value1) < float(value2)
        elif condition == ">=":
            passed = float(value1) >= float(value2)
        elif condition == "<=":
            passed = float(value1) <= float(value2)
        else:
            return False, f"Unsupported condition: {condition}"
    except (ValueError, TypeError) as e:
        print(f"Error evaluating condition: {e} (values: {value1}, {value2})")
        return False, f"Error evaluating condition: values not comparable"

    # Return result and any failure message
    failure_message = precondition.get('failure_message') if not passed else None
    return passed, failure_message

def save_quiz_results(user_id: int, results: Dict, context: Dict) -> Dict:
    """Save quiz results, handling different universal_id formats."""
    if not results: return {'success': True, 'operations': [], 'message': 'No results to save'}

    if 'user' in g: context['user'] = g.user # Example if user object is stored in g
    context['user_id'] = user_id  # Ensure user_id is in context

    operations_results = {'success': True, 'operations': [], 'message': ''}
    failed_ids = []
    skipped_ids = []
    
    # Create a list to track operations with unresolved variables to attempt again later
    deferred_ops = []
    # Track operations that were already processed to avoid infinite loops
    processed_universal_ids = set()

    # Check preconditions if present in quiz data
    quiz_id = context.get('quiz_id')
    if quiz_id:
        try:
            quiz_data = get_quiz_by_id(quiz_id)
            if quiz_data and 'json' in quiz_data:
                quiz_json = json.loads(quiz_data['json']) if isinstance(quiz_data['json'], str) else quiz_data['json']
                preconditions = quiz_json.get('preconditions', [])
                
                # Process each precondition
                for precondition in preconditions:
                    passed, failure_message = _evaluate_precondition(precondition, context)
                    
                    if not passed:
                        # Precondition failed, return without saving anything
                        operations_results['success'] = False
                        operations_results['message'] = failure_message or 'A precondition check failed'
                        return operations_results
        except Exception as e:
            print(f"Error processing preconditions: {e}")
            operations_results['success'] = False
            operations_results['message'] = f'Error in precondition checking: {str(e)}'
            return operations_results

    # Save regular quiz answers
    for universal_id, value in results.items():
        # Skip empty universal_ids
        if not universal_id or universal_id.strip() == "":
            skipped_ids.append("empty_id")
            operations_results['operations'].append({
                'universal_id': 'empty_id', 
                'success': True,
                'message': 'Skipped (empty universal_id)'
            })
            continue
            
        # Add to processed set to avoid repeated processing
        processed_universal_ids.add(universal_id)
            
        # Check if this universal_id has a variable that needs to be resolved
        has_unresolved_var = False
        # Parse universal_id to check for unresolved variables in key_value
        if re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', universal_id):
            parsed = parse_universal_id(universal_id)
            if parsed:
                # Check if key_value contains an unresolved variable
                key_value = _substitute_context(parsed['key_value'], context)
                if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
                    # Variable couldn't be resolved, defer this operation
                    print(f"Deferring operation on {universal_id} - variable {parsed['key_value']} not resolved yet")
                    deferred_ops.append((universal_id, value))
                    has_unresolved_var = True
        
        if has_unresolved_var:
            continue
        
        # If we got here, there are no unresolved variables, proceed with the save
        success = save_data_for_universal_id(universal_id, value, context)
        operations_results['operations'].append({
            'universal_id': universal_id, 'success': success,
            'message': 'Saved' if success else 'Failed'
        })
        if not success:
            operations_results['success'] = False
            failed_ids.append(universal_id)

    # Process completion operations if present in quiz data
    quiz_id = context.get('quiz_id')
    if quiz_id:
        try:
            quiz_data = get_quiz_by_id(quiz_id)
            if quiz_data and 'json' in quiz_data:
                quiz_json = json.loads(quiz_data['json']) if isinstance(quiz_data['json'], str) else quiz_data['json']
                completion_operations = quiz_json.get('completion_operation', [])
                
                # Process each completion operation
                for operation in completion_operations:
                    if 'value' in operation and 'universal_id' in operation:
                        # Check conditions if they exist
                        if 'conditions' in operation and isinstance(operation['conditions'], list):
                            # Skip this operation if any condition fails
                            all_conditions_met = True
                            for condition in operation['conditions']:
                                passed, _ = _evaluate_precondition(condition, context)
                                if not passed:
                                    all_conditions_met = False
                                    break
                            
                            if not all_conditions_met:
                                print(f"Skipping completion operation for {operation['universal_id']} - conditions not met")
                                continue
                                
                        # Substitute context variables in value
                        raw_value = operation['value']
                        
                        # Check if value is a universal_id
                        if re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', raw_value):
                            # Get data from another universal_id
                            value = get_data_for_universal_id(raw_value, context)
                        elif raw_value.startswith('<') and raw_value.endswith('>'):
                            # Get value from context directly
                            var_name = raw_value[1:-1]
                            value = context.get(var_name, "")
                        else:
                            # Substitute context in the literal value
                            value = _substitute_context(raw_value, context)
                        
                        # Skip empty universal_ids in completion operations too
                        universal_id = operation['universal_id']
                        if not universal_id or universal_id.strip() == "":
                            skipped_ids.append("empty_completion_id")
                            operations_results['operations'].append({
                                'universal_id': 'empty_completion_id', 
                                'success': True,
                                'message': 'Skipped completion operation (empty universal_id)'
                            })
                            continue
                            
                        # Check if universal_id has unresolved variables
                        has_unresolved_var = False
                        if re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', universal_id):
                            parsed = parse_universal_id(universal_id)
                            if parsed:
                                key_value = _substitute_context(parsed['key_value'], context)
                                if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
                                    # Variable couldn't be resolved, defer this operation
                                    print(f"Deferring completion operation on {universal_id} - variable {parsed['key_value']} not resolved yet")
                                    deferred_ops.append((universal_id, value))
                                    has_unresolved_var = True
                                    
                        if has_unresolved_var:
                            continue
                        
                        # Save the value using the universal_id
                        success = save_data_for_universal_id(universal_id, value, context)
                        
                        operations_results['operations'].append({
                            'universal_id': universal_id, 
                            'success': success,
                            'message': f'Completion operation saved' if success else f'Completion operation failed'
                        })
                        
                        if not success:
                            operations_results['success'] = False
                            failed_ids.append(universal_id)
        except Exception as e:
            print(f"Error processing completion operations: {e}")
            operations_results['success'] = False
            operations_results['message'] = f'Error in completion operations: {str(e)}'
    
    # Now try to process any deferred operations
    if deferred_ops:
        print(f"Processing {len(deferred_ops)} deferred operations")
        # Track which operations still couldn't be processed in this round
        still_deferred = []
        # Keep track of operations with variables that can never be resolved in this session
        unresolvable_ops = []
        
        # Process deferred operations
        for universal_id, value in deferred_ops:
            # Skip if this universal_id was already processed (avoid infinite loops)
            if universal_id in processed_universal_ids:
                continue
                
            # Add to processed set to prevent future reprocessing of the same ID
            processed_universal_ids.add(universal_id)
            
            # Check if variable is now resolved
            has_unresolved_var = False
            if re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', universal_id):
                parsed = parse_universal_id(universal_id)
                if parsed:
                    key_value = _substitute_context(parsed['key_value'], context)
                    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
                        # Variable still couldn't be resolved
                        print(f"Variable {parsed['key_value']} in {universal_id} still not resolved")
                        still_deferred.append((universal_id, value))
                        has_unresolved_var = True
            
            if has_unresolved_var:
                continue
                
            # If we got here, variable is now resolved, try saving
            print(f"Now processing previously deferred operation on {universal_id}")
            success = save_data_for_universal_id(universal_id, value, context)
            operations_results['operations'].append({
                'universal_id': universal_id, 
                'success': success,
                'message': f'Deferred operation saved' if success else f'Deferred operation failed'
            })
            
            if not success:
                operations_results['success'] = False
                failed_ids.append(universal_id)
        
        # Check if we still have deferred operations
        if still_deferred:
            # Add to skipped IDs as we can't resolve these variables
            for universal_id, _ in still_deferred:
                skipped_ids.append(universal_id)
                operations_results['operations'].append({
                    'universal_id': universal_id, 
                    'success': False,
                    'message': 'Skipped (unresolved variable in universal_id)'
                })

    if not operations_results['success']:
        operations_results['message'] = f'Failed to save results for: {", ".join(failed_ids)}'
    else:
        if skipped_ids:
            operations_results['message'] = f'All results saved successfully. Skipped {len(skipped_ids)} operations with unresolved variables or empty IDs.'
        else:
            operations_results['message'] = 'All results saved successfully.'

    close_db()
    return operations_results

def get_specific_user_data(user_id: int, universal_ids: List[str], context: Dict = None) -> Dict:
    """Retrieve specific data fields using universal IDs."""
    context = context or {}
    context['user_id'] = user_id
    if 'user' in g: context['user'] = g.user # Example

    result_data = {}
    for uid in universal_ids:
        if not uid: result_data[uid] = ""
        else: result_data[uid] = get_data_for_universal_id(uid, context)
    return result_data

def check_user_missing_info(user_id: int) -> Dict:
    """
    Check if user has complete information across user_info, driver_info, and car_info tables.
    
    Args:
        user_id: The user ID to check
        
    Returns:
        Dict with status of each info category and associated quiz_id
    """
    conn = get_db()
    result = {
        'user_info': {'isComplete': False, 'quiz_id': 'user_info_quiz'},
        'driver_info': {'isComplete': False, 'quiz_id': 'driver_info_quiz'},
        'car_info': {'isComplete': False, 'quiz_id': 'car_info_quiz'}
    }
    
    try:
        # Check user_info table
        cursor = execute_with_retry(
            conn,
            '''
            SELECT given_name, surname, birth_date 
            FROM user_info 
            WHERE user_id = ?
            ''',
            (user_id,)
        )
        user_info_row = cursor.fetchone()
        if user_info_row and all(user_info_row[field] is not None for field in ['given_name', 'surname', 'birth_date']):
            result['user_info']['isComplete'] = True
            
        # Check driver_info table
        cursor = execute_with_retry(
            conn,
            '''
            SELECT dln, license_expiration, licensed_state 
            FROM driver_info 
            WHERE driver_id = ?
            ''',
            (user_id,)
        )
        driver_info_row = cursor.fetchone()
        if driver_info_row and all(driver_info_row[field] is not None for field in ['dln', 'license_expiration', 'licensed_state']):
            result['driver_info']['isComplete'] = True
            
        # Check car_info table
        cursor = execute_with_retry(
            conn,
            '''
            SELECT license_plate, max_capacity
            FROM car_info 
            WHERE driver_id = ?
            ''',
            (user_id,)
        )
        car_info_row = cursor.fetchone()
        if car_info_row and all(car_info_row[field] is not None for field in ['license_plate', 'max_capacity']):
            result['car_info']['isComplete'] = True
    
    except sqlite3.Error as e:
        print(f"Error checking user missing info for user ID {user_id}: {e}")
    
    return result

def get_user_full_profile(user_id: int) -> Dict:
    """Get complete user profile information including user details, driver info, and cars.
    
    Args:
        user_id: The user ID to get profile for
        
    Returns:
        Dictionary with user profile data from multiple tables
    """
    conn = get_db()
    result = {
        'user_info': None,
        'driver_info': None,
        'cars': []
    }
    
    try:
        # Get basic user info
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            (user_id,)
        )
        user = cursor.fetchone()
        if not user:
            return result
            
        result['user_info'] = dict(user)
        
        # Get detailed user info (name, birthdate, etc)
        cursor = execute_with_retry(
            conn,
            '''
            SELECT given_name, surname, birth_date, sex, home_address, misc_user_data
            FROM user_info 
            WHERE user_id = ?
            ''',
            (user_id,)
        )
        user_info_row = cursor.fetchone()
        if user_info_row:
            # Add to user_info
            user_info_dict = dict(user_info_row)
            result['user_info'].update(user_info_dict)
            
            # Process misc_user_data if it exists
            if user_info_dict.get('misc_user_data'):
                try:
                    misc_data = json.loads(user_info_dict['misc_user_data'])
                    # Merge the misc_data into the user_info dict
                    result['user_info'].update(misc_data)
                    # Remove the raw JSON string
                    result['user_info'].pop('misc_user_data', None)
                except (json.JSONDecodeError, TypeError):
                    pass
            
        # Get driver info
        cursor = execute_with_retry(
            conn,
            '''
            SELECT dln, license_expiration, licensed_state, misc_data
            FROM driver_info 
            WHERE driver_id = ?
            ''',
            (user_id,)
        )
        driver_info_row = cursor.fetchone()
        if driver_info_row:
            # Convert to dict
            driver_info_dict = dict(driver_info_row)
            result['driver_info'] = driver_info_dict
            
            # Process misc_data if it exists
            if driver_info_dict.get('misc_data'):
                try:
                    misc_data = json.loads(driver_info_dict['misc_data'])
                    # Merge the misc_data into the driver_info dict
                    result['driver_info'].update(misc_data)
                    # Remove the raw JSON string
                    result['driver_info'].pop('misc_data', None)
                except (json.JSONDecodeError, TypeError):
                    pass
        
        # Get all cars for this user
        cursor = execute_with_retry(
            conn,
            '''
            SELECT 
                license_plate, registered_state, make, model, 
                year, max_capacity, misc_data
            FROM car_info 
            WHERE driver_id = ?
            ''',
            (user_id,)
        )
        
        cars = cursor.fetchall()
        if cars:
            for car in cars:
                car_dict = dict(car)
                
                # Process misc_data if it exists
                if car_dict.get('misc_data'):
                    try:
                        misc_data = json.loads(car_dict['misc_data'])
                        # Merge the misc_data into the car dict
                        car_dict.update(misc_data)
                        # Remove the raw JSON string
                        car_dict.pop('misc_data', None)
                    except (json.JSONDecodeError, TypeError):
                        pass
                
                result['cars'].append(car_dict)
                
        return result
    except sqlite3.Error as e:
        print(f"Error getting full profile for user ID {user_id}: {e}")
        return result

def delete_car(driver_id: int, license_plate: str) -> bool:
    """Delete a car from the car_info table.
    
    Args:
        driver_id: The ID of the user/driver who owns the car
        license_plate: The license plate of the car to delete
        
    Returns:
        True if deletion was successful, False otherwise
    """
    conn = get_db()
    try:
        # First verify that this car belongs to this driver
        cursor = execute_with_retry(
            conn,
            'SELECT license_plate FROM car_info WHERE driver_id = ? AND license_plate = ?',
            (driver_id, license_plate)
        )
        
        car = cursor.fetchone()
        if not car:
            # Car not found or doesn't belong to this driver
            return False
            
        # Delete the car
        execute_with_retry(
            conn,
            'DELETE FROM car_info WHERE license_plate = ?',
            (license_plate,)
        )
        
        return True
    except sqlite3.Error as e:
        print(f"Error deleting car {license_plate} for driver {driver_id}: {e}")
        return False

def get_route_information(carpool: Dict, filters: Dict = None) -> Dict:
    """
    Calculate route information between user's pickup/dropoff locations and the carpool's route.
    This will be used to determine if a carpool is a good match for the user based on distance,
    time, and other route-related factors.
    
    Args:
        carpool: Dictionary containing carpool information including driver and passenger details
        filters: Optional dictionary containing filter criteria including:
            - pickup_location: User's pickup location
            - dropoff_location: User's dropoff location
            - arrival_date: Date of arrival at destination
            
    Returns:
        Dictionary containing route information:
            - pickup_distance: Distance from user's pickup to carpool origin
            - dropoff_distance: Distance from carpool destination to user's dropoff
            - total_distance: Total distance of the route
            - total_duration: Total duration of the route in minutes
            - pickup_time: Estimated pickup time
            - dropoff_time: Estimated dropoff time
            - is_viable: Whether this carpool is viable for the user (only if filters provided)
    """
    filters = filters or {}
    pickup_location = filters.get('pickup_location')
    dropoff_location = filters.get('dropoff_location')
    arrival_date = filters.get('arrival_date')
    
    # If no pickup or dropoff location provided and filters were expected, return basic info
    if filters and (not pickup_location or not dropoff_location):
        return {
            'pickup_location': pickup_location,
            'dropoff_location': dropoff_location,
            'arrival_date': arrival_date,
            'is_viable': True  # Default to viable if no specific locations are provided
        }
        
    # Get Google Maps client
    gmaps = get_gmaps_client()
    
    # Get carpool origin and destination
    carpool_origin = carpool['route']['origin']
    carpool_destination = carpool['route']['destination']
    
    # Set departure and arrival times for driver
    # Parse the time strings from the carpool
    driver_earliest_departure = None
    driver_latest_arrival = None
    
    if arrival_date:
        # If we have an arrival date, combine it with the time
        try:
            date_obj = datetime.strptime(arrival_date, "%Y-%m-%d")
            
            if carpool['route']['leave_earliest']:
                # Check if the time contains a semicolon (which indicates a combined date-time format)
                if ';' in carpool['route']['leave_earliest']:
                    # This is a combined date-time format like "04-17-2025;10:49"
                    # Extract just the time portion and parse it
                    time_part = carpool['route']['leave_earliest'].split(';')[1]
                    time_obj = datetime.strptime(time_part, "%H:%M")
                else:
                    # Standard time format
                    time_obj = datetime.strptime(carpool['route']['leave_earliest'], "%H:%M")
                
                driver_earliest_departure = datetime.combine(
                    date_obj.date(), 
                    time_obj.time()
                )
            
            if carpool['route']['arrive_by']:
                # Check if the time contains a semicolon
                if ';' in carpool['route']['arrive_by']:
                    # Combined date-time format
                    time_part = carpool['route']['arrive_by'].split(';')[1]
                    time_obj = datetime.strptime(time_part, "%H:%M")
                else:
                    # Standard time format
                    time_obj = datetime.strptime(carpool['route']['arrive_by'], "%H:%M")
                
                driver_latest_arrival = datetime.combine(
                    date_obj.date(), 
                    time_obj.time()
                )
        except ValueError as e:
            print(f"Error parsing driver dates: {e}")
            # Use current time as fallback
            driver_earliest_departure = datetime.now()
    else:
        # Use current time if no travel date specified
        driver_earliest_departure = datetime.now()
        
    # If driver_earliest_departure is in the past, set it to now
    if driver_earliest_departure and driver_earliest_departure < datetime.now():
        print(f"Adjusting driver departure time from {driver_earliest_departure} to now as it was in the past")
        driver_earliest_departure = datetime.now()
    
    # Collect all passenger pickup/dropoff locations and time constraints
    waypoints = []
    time_constraints = []
    
    # Add driver constraints
    time_constraints.append({
        'name': carpool['driver']['full_name'],
        'type': 'driver',
        'earliest_departure': driver_earliest_departure,
        'latest_arrival': driver_latest_arrival
    })
    
    # Process existing passengers
    for passenger in carpool.get('passengers', []):
        p_pickup = passenger.get('pickup_location')
        p_dropoff = passenger.get('dropoff_location')
        
        # Add existing pickup and dropoff points as waypoints
        if p_pickup:
            waypoints.append(p_pickup)
        if p_dropoff:
            waypoints.append(p_dropoff)
        
        # Process passenger time constraints
        p_pickup_time = passenger.get('pickup_time')
        p_dropoff_time = passenger.get('dropoff_time')
        
        p_earliest_departure = None
        p_latest_arrival = None
        
        if arrival_date and p_pickup_time:
            try:
                date_obj = datetime.strptime(arrival_date, "%Y-%m-%d")
                time_obj = datetime.strptime(p_pickup_time, "%H:%M")
                p_earliest_departure = datetime.combine(date_obj.date(), time_obj.time())
            except ValueError:
                pass
                
        if arrival_date and p_dropoff_time:
            try:
                date_obj = datetime.strptime(arrival_date, "%Y-%m-%d")
                time_obj = datetime.strptime(p_dropoff_time, "%H:%M")
                p_latest_arrival = datetime.combine(date_obj.date(), time_obj.time())
            except ValueError:
                pass
        
        time_constraints.append({
            'name': passenger.get('full_name', passenger.get('username', 'Unknown passenger')),
            'type': 'passenger',
            'earliest_departure': p_earliest_departure,
            'latest_arrival': p_latest_arrival
        })
    
    # Calculate direct route without the user (original carpool route with existing passengers)
    original_route = calculate_route(
        gmaps, 
        carpool_origin, 
        carpool_destination, 
        waypoints=waypoints,
        departure_time=driver_earliest_departure
    )
    
    if not original_route:
        result = {
            'error': 'Could not calculate original route',
        }
        if filters:
            result.update({
                'pickup_location': pickup_location,
                'dropoff_location': dropoff_location,
                'arrival_date': arrival_date,
                'is_viable': False
            })
        return result
    
    # Calculate original route metrics
    original_legs = original_route.get('legs', [])
    original_distance = sum(leg['distance']['value'] for leg in original_legs) / 1609.34  # Convert meters to miles
    original_duration = sum(leg['duration']['value'] for leg in original_legs) / 60  # Convert seconds to minutes
    
    # If no filters provided, calculate basic route information without user pickup/dropoff
    if not filters or (not pickup_location and not dropoff_location):
        # Prepare the route information to return
        route_info = {
            'total_distance': round(original_distance, 1),  # Total route distance in miles
            'total_duration': round(original_duration, 1),  # Total route duration in minutes
            'new_departure_time': driver_earliest_departure.strftime("%H:%M"),  # New departure time
            'estimated_arrival': (driver_earliest_departure + timedelta(minutes=original_duration)).strftime("%H:%M"),
            'passenger_count': len(carpool.get('passengers', [])),  # Number of existing passengers
            'total_stops': len(waypoints)  # Total number of stops in the route
        }
        return route_info
    
    # Add new user's pickup and dropoff locations to waypoints
    new_waypoints = waypoints.copy()
    new_waypoints.append(pickup_location)
    new_waypoints.append(dropoff_location)
    
    # Calculate route with user's pickup and dropoff
    new_route = calculate_route(
        gmaps,
        carpool_origin,
        carpool_destination,
        waypoints=new_waypoints,
        departure_time=driver_earliest_departure
    )
    
    if not new_route:
        result = {
            'error': 'Could not calculate route with pickup/dropoff locations',
        }
        if filters:
            result.update({
                'pickup_location': pickup_location,
                'dropoff_location': dropoff_location,
                'arrival_date': arrival_date,
                'is_viable': False
            })
        return result
    
    # Extract leg information
    new_legs = new_route.get('legs', [])
    
    # Calculate total distance and duration for new route
    total_distance_meters = sum(leg['distance']['value'] for leg in new_legs)
    total_duration_seconds = sum(leg['duration']['value'] for leg in new_legs)
    
    total_distance = total_distance_meters / 1609.34  # Convert meters to miles
    total_duration = total_duration_seconds / 60  # Convert seconds to minutes
    
    # Calculate detour information (how much the new route deviates from original)
    distance_detour = total_distance - original_distance
    duration_detour = total_duration - original_duration
          
    try:
        # For accurate calculation, the Google Distance Matrix API is used to calculate
        # the actual distance from origin to user's pickup and from origin to user's dropoff
        origin_to_pickup = gmaps.distance_matrix(
            carpool_origin, 
            pickup_location, 
            mode="driving",
            departure_time=driver_earliest_departure
        )
        
        # Instead of calculating origin to dropoff directly, calculate pickup to dropoff
        # This ensures proper sequencing: origin -> pickup -> dropoff -> destination
        pickup_to_dropoff = gmaps.distance_matrix(
            pickup_location, 
            dropoff_location, 
            mode="driving",
            departure_time=driver_earliest_departure
        )
        
        # Extract the time it takes to go from origin to pickup location
        pickup_time_seconds = origin_to_pickup['rows'][0]['elements'][0]['duration']['value']
        
        # Extract the time it takes to go from pickup to dropoff location
        pickup_to_dropoff_seconds = pickup_to_dropoff['rows'][0]['elements'][0]['duration']['value']
        
        # Dropoff time is pickup time plus travel time from pickup to dropoff
        dropoff_time_seconds = pickup_time_seconds + pickup_to_dropoff_seconds
        
        # Calculate the actual times
        pickup_time = driver_earliest_departure + timedelta(seconds=pickup_time_seconds)
        dropoff_time = driver_earliest_departure + timedelta(seconds=dropoff_time_seconds)
        
        # If pickup time is after dropoff time, that's an error
        # In this case, fall back to a different approach
        if pickup_time >= dropoff_time:
            raise ValueError("Pickup time calculation error")
            
    except Exception as e:
        print(f"Error calculating precise pickup/dropoff times: {e}")
        # Fall back to a different estimation method
        # Calculating based on the actual proportion of the journey
        
        # Get distances from origin to each point and from each point to destination
        try:
            # Calculate distance from origin to pickup
            origin_to_pickup_dist = gmaps.distance_matrix(
                carpool_origin, 
                pickup_location, 
                mode="driving"
            )['rows'][0]['elements'][0]['distance']['value']
            
            # Calculate distance from pickup to dropoff
            pickup_to_dropoff_dist = gmaps.distance_matrix(
                pickup_location, 
                dropoff_location, 
                mode="driving"
            )['rows'][0]['elements'][0]['distance']['value']
            
            # Calculate distance from origin to destination (direct)
            origin_to_dest_dist = gmaps.distance_matrix(
                carpool_origin, 
                carpool_destination, 
                mode="driving"
            )['rows'][0]['elements'][0]['distance']['value']
            
            # Calculate proportions of the journey
            pickup_proportion = origin_to_pickup_dist / origin_to_dest_dist
            dropoff_proportion = (origin_to_pickup_dist + pickup_to_dropoff_dist) / origin_to_dest_dist
            
            # Limit proportions to valid range
            pickup_proportion = max(0.1, min(0.9, pickup_proportion))
            dropoff_proportion = max(pickup_proportion + 0.1, min(0.95, dropoff_proportion))
            
            # Calculate times based on these proportions
            pickup_time_seconds = total_duration_seconds * pickup_proportion
            dropoff_time_seconds = total_duration_seconds * dropoff_proportion
            
        except Exception as e:
            print(f"Error calculating distance-based proportions: {e}")
            # If all fails, use a more reasonable default
            pickup_time_seconds = total_duration_seconds * 0.25  # 25% of the way
            dropoff_time_seconds = total_duration_seconds * 0.75  # 75% of the way
        
        pickup_time = driver_earliest_departure + timedelta(seconds=pickup_time_seconds)
        dropoff_time = driver_earliest_departure + timedelta(seconds=dropoff_time_seconds)
    
    # Calculate estimated arrival time at carpool destination with detour
    estimated_arrival = driver_earliest_departure + timedelta(seconds=total_duration_seconds)
    
    # Prepare the route information to return
    route_info = {
        'pickup_location': pickup_location,
        'dropoff_location': dropoff_location,
        'arrival_date': arrival_date,
        'pickup_distance': round(distance_detour / 2, 1),  # Rough estimate of pickup distance
        'dropoff_distance': round(distance_detour / 2, 1),  # Rough estimate of dropoff distance
        'total_distance': round(total_distance, 1),  # Total route distance in miles
        'original_distance': round(original_distance, 1),  # Original carpool route distance in miles
        'distance_detour': round(distance_detour, 1),  # Extra distance added by the detour in miles
        'total_duration': round(total_duration, 1),  # Total route duration in minutes
        'original_duration': round(original_duration, 1),  # Original carpool route duration in minutes
        'duration_detour': round(duration_detour, 1),  # Extra time added by the detour in minutes
        'pickup_time': pickup_time.strftime("%H:%M"),  # Estimated pickup time
        'dropoff_time': dropoff_time.strftime("%H:%M"),  # Estimated dropoff time
        'new_departure_time': driver_earliest_departure.strftime("%H:%M"),  # New departure time
        'estimated_arrival': estimated_arrival.strftime("%H:%M"),  # Estimated arrival time at final destination
        'passenger_count': len(carpool.get('passengers', [])),  # Number of existing passengers
        'total_stops': len(new_waypoints)  # Total number of stops in the route
    }
    
    # Only check viability if filters were provided
    if filters:
        # Check if this would exceed any time constraints
        is_viable = True
        viability_issues = []
        
        # Check passenger time constraints for existing passengers
        for constraint in time_constraints:
            if constraint['type'] == 'passenger' and constraint['latest_arrival']:
                if constraint['latest_arrival'] < dropoff_time:
                    is_viable = False
                    viability_issues.append(
                        f"Would conflict with {constraint['name']}'s latest arrival time of {constraint['latest_arrival'].strftime('%H:%M')}"
                    )
        
        # Get user's earliest pickup time from filters
        user_earliest_pickup = None
        if filters.get('earliest_pickup') and arrival_date:
            try:
                earliest_pickup_str = filters.get('earliest_pickup')
                if ':' in earliest_pickup_str:
                    date_obj = datetime.strptime(arrival_date, "%Y-%m-%d")
                    time_obj = datetime.strptime(earliest_pickup_str, "%H:%M")
                    user_earliest_pickup = datetime.combine(date_obj.date(), time_obj.time())
            except ValueError as e:
                print(f"Error parsing earliest pickup time: {e}")
        
        # Get user's latest arrival time from filters
        user_latest_arrival = None
        if filters.get('latest_arrival') and arrival_date:
            try:
                latest_arrival_str = filters.get('latest_arrival')
                if ':' in latest_arrival_str:
                    date_obj = datetime.strptime(arrival_date, "%Y-%m-%d")
                    time_obj = datetime.strptime(latest_arrival_str, "%H:%M")
                    user_latest_arrival = datetime.combine(date_obj.date(), time_obj.time())
            except ValueError as e:
                print(f"Error parsing latest arrival time: {e}")
        
        # Check if the current calculated pickup time works with user's earliest pickup time
        needs_adjusted_departure = False
        adjusted_departure_time = driver_earliest_departure
        
        if user_earliest_pickup and pickup_time < user_earliest_pickup:
            # Instead of marking as not viable, calculate a new departure time that would work
            time_difference = (user_earliest_pickup - pickup_time).total_seconds()
            adjusted_departure_time = driver_earliest_departure + timedelta(seconds=time_difference)
            needs_adjusted_departure = True
        
        # Recalculate arrival time with the adjusted departure time
        adjusted_arrival_time = adjusted_departure_time + timedelta(seconds=total_duration_seconds)
        
        # Check if the adjusted arrival time would still meet the driver's latest arrival constraint
        if driver_latest_arrival and adjusted_arrival_time > driver_latest_arrival:
            is_viable = False
            viability_issues.append(
                f"With your earliest pickup time of {user_earliest_pickup.strftime('%H:%M')}, " + 
                f"the trip would arrive after driver's latest arrival time of {driver_latest_arrival.strftime('%H:%M')}"
            )
        elif needs_adjusted_departure:
            # Update the route info with adjusted times
            pickup_time = user_earliest_pickup
            dropoff_time = pickup_time + timedelta(seconds=pickup_to_dropoff_seconds)
            
            route_info.update({
                'pickup_time': pickup_time.strftime("%H:%M"),
                'dropoff_time': dropoff_time.strftime("%H:%M"),
                'new_departure_time': adjusted_departure_time.strftime("%H:%M"),
                'estimated_arrival': adjusted_arrival_time.strftime("%H:%M"),
                'adjusted_departure': True  # Flag to indicate we adjusted the departure time
            })
        
        # Check if the dropoff time works with user's latest arrival constraint
        if user_latest_arrival and dropoff_time > user_latest_arrival:
            is_viable = False
            viability_issues.append(
                f"Dropoff time {dropoff_time.strftime('%H:%M')} is after your latest acceptable time {user_latest_arrival.strftime('%H:%M')}"
            )
        
        route_info['is_viable'] = is_viable
        route_info['viability_issues'] = viability_issues if not is_viable else []
    
    return route_info

# Setup Google Maps client
def get_gmaps_client():
    """Get a Google Maps client instance with API key"""
    api_key = current_app.config.get('GOOGLE_MAPS_API_KEY')
    if not api_key:
        raise ValueError("Google Maps API key not configured")
    return googlemaps.Client(key=api_key)

def calculate_route(gmaps, origin, destination, waypoints=None, departure_time=None):
    """
    Calculate a route between origin and destination, with optional waypoints
    
    Args:
        gmaps: Google Maps client instance
        origin: Origin address or coordinates
        destination: Destination address or coordinates
        waypoints: List of waypoints to include in the route
        departure_time: Departure time for the route
        
    Returns:
        Route information including distance, duration, steps
    """
    try:
        # Set departure time to now if not specified or if it's in the past
        now = datetime.now()
        if departure_time is None or departure_time < now:
            departure_time = now
        
        # Make directions API call
        directions_result = gmaps.directions(
            origin,
            destination,
            mode="driving",
            waypoints=waypoints,
            optimize_waypoints=True,
            departure_time=departure_time
        )
        
        if not directions_result:
            return None
        
        return directions_result[0]
    except Exception as e:
        print(f"Error calculating route: {e}")
        return None

def remove_passenger_from_carpool(carpool_id: int, passenger_id: int) -> Dict:
    """
    Remove a passenger from a carpool.
    
    This can be called by either:
    - The passenger themselves (leaving the carpool)
    - The driver of the carpool (kicking the passenger)
    
    Args:
        carpool_id: ID of the carpool
        passenger_id: ID of the passenger to remove
        
    Returns:
        Dictionary containing result information:
            - success: Boolean indicating if operation was successful
            - message: Descriptive message
    """
    db = get_db()
    
    try:
        # First check if the passenger is actually in this carpool
        check_query = "SELECT passenger_id FROM carpool_passengers WHERE carpool_id = ? AND passenger_id = ?"
        existing = db.execute(check_query, (carpool_id, passenger_id)).fetchone()
        
        if not existing:
            return {
                'success': False,
                'message': 'Passenger is not in this carpool'
            }
        
        # Remove the passenger from the carpool
        delete_query = "DELETE FROM carpool_passengers WHERE carpool_id = ? AND passenger_id = ?"
        db.execute(delete_query, (carpool_id, passenger_id))
        db.commit()
        
        return {
            'success': True,
            'message': 'Passenger removed from carpool successfully'
        }
        
    except sqlite3.Error as e:
        db.rollback()
        print(f"Error removing passenger from carpool: {e}")
        return {
            'success': False,
            'message': f'Database error: {str(e)}'
        }

def get_user_role_in_carpool(carpool_id: int, user_id: int) -> Dict:
    """
    Determine a user's role in a carpool (driver, passenger, or none).
    
    Args:
        carpool_id: ID of the carpool
        user_id: ID of the user
        
    Returns:
        Dictionary containing role information:
            - is_driver: Boolean indicating if user is the driver
            - is_passenger: Boolean indicating if user is a passenger
            - carpool_exists: Boolean indicating if the carpool exists
    """
    db = get_db()
    
    try:
        # Check if carpool exists
        carpool_query = "SELECT driver_id FROM carpool_list WHERE carpool_id = ?"
        carpool = db.execute(carpool_query, (carpool_id,)).fetchone()
        
        if not carpool:
            return {
                'is_driver': False,
                'is_passenger': False,
                'carpool_exists': False
            }
        
        # Check if user is the driver
        is_driver = carpool['driver_id'] == user_id
        
        # Check if user is a passenger
        passenger_query = "SELECT passenger_id FROM carpool_passengers WHERE carpool_id = ? AND passenger_id = ?"
        passenger = db.execute(passenger_query, (carpool_id, user_id)).fetchone()
        is_passenger = passenger is not None
        
        return {
            'is_driver': is_driver,
            'is_passenger': is_passenger,
            'carpool_exists': True
        }
        
    except sqlite3.Error as e:
        print(f"Error checking user role in carpool: {e}")
        return {
            'is_driver': False,
            'is_passenger': False,
            'carpool_exists': False,
            'error': str(e)
        }

def get_user_carpools(user_id: int, role_filter: str = 'either', arrival_date: str = None, hide_past: bool = True) -> List[Dict]:
    """
    Get carpools where the user is either a driver or a passenger, with optional filtering.
    
    Args:
        user_id: ID of the user
        role_filter: Filter by user's role - 'driver', 'passenger', or 'either' (default)
        arrival_date: Filter by arrival date (YYYY-MM-DD format)
        hide_past: If True, hide carpools with arrival time in the past
        
    Returns:
        List of carpools where the user has the specified role
    """
    db = get_db()
    carpools = []
    
    try:
        # Current datetime for filtering past carpools
        current_datetime = datetime.now()
        
        # Initialize query parameters
        params = []
        
        # Build the query based on role_filter
        if role_filter == 'driver' or role_filter == 'either':
            # Get carpools where user is the driver
            driver_query = '''
                SELECT carpool_id 
                FROM carpool_list 
                WHERE driver_id = ?
            '''
            
            # Add filtering for past carpools if required
            if hide_past:
                driver_query += '''
                    AND (
                        (arrive_by IS NULL) OR 
                        (arrive_by = '') OR
                        (
                            arrive_by IS NOT NULL AND
                            (
                                strftime('%Y-%m-%d %H:%M', 
                                    substr(arrive_by, 7, 4) || '-' || 
                                    substr(arrive_by, 1, 2) || '-' || 
                                    substr(arrive_by, 4, 2) || ' ' || 
                                    substr(arrive_by, 12)
                                ) > strftime('%Y-%m-%d %H:%M', 'now')
                            )
                        )
                    )
                '''
                
            # Add filtering for specific arrival date if provided
            if arrival_date:
                driver_query += ''' 
                    AND (
                        substr(arrive_by, 7, 4) || '-' || 
                        substr(arrive_by, 1, 2) || '-' || 
                        substr(arrive_by, 4, 2) = ?
                    )
                '''
                params = [user_id, arrival_date]
            else:
                params = [user_id]
                
            driver_results = db.execute(driver_query, params).fetchall()
            
            # Add the driver carpools to the results
            for row in driver_results:
                carpool = get_carpool_listing(row['carpool_id'])
                if carpool:
                    carpool['user_role'] = 'driver'
                    carpools.append(carpool)
        
        if role_filter == 'passenger' or role_filter == 'either':
            # Get carpools where user is a passenger
            passenger_query = '''
                SELECT cp.carpool_id 
                FROM carpool_passengers cp
                JOIN carpool_list cl ON cp.carpool_id = cl.carpool_id
                WHERE cp.passenger_id = ?
            '''
            
            # Add filtering for past carpools if required
            if hide_past:
                passenger_query += '''
                    AND (
                        (cl.arrive_by IS NULL) OR 
                        (cl.arrive_by = '') OR
                        (
                            cl.arrive_by IS NOT NULL AND
                            (
                                strftime('%Y-%m-%d %H:%M', 
                                    substr(cl.arrive_by, 7, 4) || '-' || 
                                    substr(cl.arrive_by, 1, 2) || '-' || 
                                    substr(cl.arrive_by, 4, 2) || ' ' || 
                                    substr(cl.arrive_by, 12)
                                ) > strftime('%Y-%m-%d %H:%M', 'now')
                            )
                        )
                    )
                '''
                
            # Add filtering for specific arrival date if provided
            if arrival_date:
                passenger_query += '''
                    AND (
                        substr(cl.arrive_by, 7, 4) || '-' || 
                        substr(cl.arrive_by, 1, 2) || '-' || 
                        substr(cl.arrive_by, 4, 2) = ?
                    )
                '''
                params = [user_id, arrival_date]
            else:
                params = [user_id]
                
            passenger_results = db.execute(passenger_query, params).fetchall()
            
            # Add the passenger carpools to the results
            for row in passenger_results:
                carpool = get_carpool_listing(row['carpool_id'])
                if carpool:
                    carpool['user_role'] = 'passenger'
                    carpools.append(carpool)
        
        # Sort carpools by arrival date (earliest first)
        def get_arrival_datetime(carpool):
            arrive_by = carpool['route']['arrive_by']
            if not arrive_by:
                return datetime.max
            try:
                # Parse MM-DD-YYYY;HH:MM format
                parts = arrive_by.split(';')
                if len(parts) != 2:
                    return datetime.max
                    
                date_part = parts[0]
                time_part = parts[1]
                
                date_parts = date_part.split('-')
                if len(date_parts) != 3:
                    return datetime.max
                    
                month, day, year = int(date_parts[0]), int(date_parts[1]), int(date_parts[2])
                
                time_parts = time_part.split(':')
                if len(time_parts) != 2:
                    return datetime.max
                    
                hour, minute = int(time_parts[0]), int(time_parts[1])
                
                return datetime(year, month, day, hour, minute)
            except (ValueError, IndexError):
                return datetime.max
                
        carpools.sort(key=get_arrival_datetime)
        
        return carpools
        
    except sqlite3.Error as e:
        print(f"Error getting user carpools: {e}")
        return []

