from flask import jsonify, request, g
from app import app, bcrypt
from app.database import (
    create_user, get_user_by_id,
    get_user_by_username, get_user_by_email,
    get_quiz_by_id, save_quiz_results, get_specific_user_data, init_app, _substitute_context,
    reserve_carpool_listing_id, get_full_carpool_details, get_public_carpool_details,
    check_user_missing_info, get_options_from_universal_id, get_user_full_profile, delete_car,
    get_carpool_list, add_passenger_to_carpool, get_user_role_in_carpool, remove_passenger_from_carpool,
    get_user_carpools
)
from flask_jwt_extended import (
    JWTManager, jwt_required, create_access_token, get_jwt_identity
)
from app.helper import is_valid_email, is_valid_password
import json
from datetime import datetime, timedelta
import re

init_app(app)

# Health check routes
@app.route('/')
def index():
    return jsonify({'status': 'healthy', 'message': 'Carpool Coordinator API is running'})

# Authentication routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['username', 'email', 'password']
    if not data or not all(field in data for field in required_fields):
        return jsonify({
            'error': 'Missing required fields',
            'required_fields': required_fields
        }), 400
    
    # Check if username already exists
    if get_user_by_username(data['username']):
        return jsonify({'error': 'Username already taken'}), 409
    
    # check if valid email format
    if is_valid_email(data['email']) == False:
        return jsonify({'error': 'Invalid email format'}), 400
    
    # check if valid password format
    if is_valid_password(data['password']) == False:
        return jsonify({'error': 'Invalid password format'}), 400
    
    # Check if email already exists
    if get_user_by_email(data['email']):
        return jsonify({'error': 'Email already registered'}), 409
    
    # Create new user
    user_id = create_user(
        username=data['username'],
        email=data['email'],
        password=data['password']
    )
    
    if not user_id:
        return jsonify({'error': 'Failed to create user'}), 500
    
    # Create access token
    access_token = create_access_token(identity=str(user_id))
    
    return jsonify({
        'message': 'User registered successfully',
        'access_token': access_token,
        'user': {
            'id': user_id,
            'username': data['username'],
            'email': data['email']
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login with username and password"""
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password are required'}), 400

    user = get_user_by_username(data['username'])
    if not user:
        return jsonify({'error': 'Invalid username or password'}), 401

    if not bcrypt.check_password_hash(user['password_hash'], data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401

    access_token = create_access_token(identity=str(user['id']))
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user['id'],
            'username': user['username']
        }
    })

# User routes
@app.route('/api/users/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get the current user's information (protected route)"""
    current_user_id = int(get_jwt_identity())
    user = get_user_by_id(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email']
        }
    })

@app.route('/api/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a user's public information"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Only return public information
    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username']
        }
    })

@app.route('/api/users/me/get-missing-info', methods=['GET'])
@jwt_required()
def get_missing_user_info():
    """Get missing information for the current user across different tables"""
    current_user_id = int(get_jwt_identity())
    
    # Check if user exists
    user = get_user_by_id(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Use the database helper function to check for missing information
    missing_info_status = check_user_missing_info(current_user_id)
    
    return jsonify(missing_info_status)

@app.route('/api/users/me/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get the complete profile of the current user including user info, driver info, and cars"""
    current_user_id = int(get_jwt_identity())
    
    # Get the user's full profile
    profile = get_user_full_profile(current_user_id)
    
    if not profile['user_info']:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'profile': profile
    })

@app.route('/api/cars/<string:license_plate>', methods=['DELETE'])
@jwt_required()
def delete_user_car(license_plate):
    """Delete a car owned by the current user"""
    current_user_id = int(get_jwt_identity())
    
    # Delete the car
    success = delete_car(current_user_id, license_plate)
    
    if not success:
        return jsonify({'error': 'Car not found or you are not authorized to delete it'}), 404
    
    return jsonify({
        'success': True,
        'message': f'Car with license plate {license_plate} deleted successfully'
    })

@app.route('/api/quiz/get', methods=['GET'])
@jwt_required()
def get_quiz():
    """Get quiz data by quiz_id (protected route)"""
    # Get quiz_id from query parameters
    quiz_id = request.args.get('quiz_id')
    
    if not quiz_id:
        return jsonify({'error': 'Quiz ID is required'}), 400
    
    # Get quiz data from database
    quiz_data = get_quiz_by_id(quiz_id)
    
    if not quiz_data:
        return jsonify({'error': 'Quiz not found'}), 404
    
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Parse quiz JSON to extract universal_ids for questions
    try:
        # Create context for variable substitution
        context = {
            'user_id': current_user_id,
            'quiz_id': quiz_id
        }
        
        # Add additional URL parameters to context if present
        for key, value in request.args.items():
            if key != 'quiz_id':  # Skip quiz_id to avoid duplication
                context[key] = value
        
        # Load quiz JSON
        quiz_json = json.loads(quiz_data['json'])
        
        
        # Process conditional questions and add them to the questions list if conditions are met
        if 'conditional_questions' in quiz_json and isinstance(quiz_json['conditional_questions'], list):
            for conditional_question in quiz_json['conditional_questions']:
                # Skip if no conditions defined
                if 'conditions' not in conditional_question or not isinstance(conditional_question['conditions'], list):
                    continue
                
                # Evaluate all conditions for this question
                all_conditions_met = True
                for condition in conditional_question['conditions']:
                    # Process the condition with the current context
                    from app.database import _evaluate_precondition
                    passed, _ = _evaluate_precondition(condition, context)
                    if not passed:
                        all_conditions_met = False
                        break
                
                # If all conditions are met, add this question to the main questions list
                if all_conditions_met:
                    if 'questions' not in quiz_json:
                        quiz_json['questions'] = []
                    quiz_json['questions'].append(conditional_question)
                    print(f"Added conditional question {conditional_question.get('id')} to quiz")
        
        # Process dynamic options in questions
        if 'questions' in quiz_json:
            for question in quiz_json['questions']:
                # Check if options field exists and is a string
                if 'options' in question and isinstance(question['options'], str):
                    # Check if the string matches a universal ID pattern
                    if re.match(r'[^[]+\[[^:]+:[^\]]+\]@[^->]+(->(.+))?', question['options']):
                        # Get options from the database using the universal ID
                        options_uid = question['options']
                        dynamic_options = get_options_from_universal_id(options_uid, context)
                        question['options'] = dynamic_options
                        print(f"Replaced dynamic options for question {question.get('id')}: {dynamic_options}")
        
        # Update the json field with the processed quiz JSON
        quiz_data['json'] = json.dumps(quiz_json)
        
        # Extract universal_ids for getting existing answers
        universal_ids = [question.get('universal_id') for question in quiz_json.get('questions', [])]
        
        # Get existing answers for these universal_ids
        existing_answers = get_specific_user_data(current_user_id, universal_ids, context)
        
        # Return quiz data along with existing answers
        return jsonify({
            'quiz_id': quiz_data['quiz_id'],
            'json': quiz_data['json'],
            'return_address': _substitute_context(quiz_data['return_address'], context),
            'existing_answers': existing_answers
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Failed to parse quiz data'}), 500
    except Exception as e:
        print(f"Error processing quiz data: {e}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/quiz/save', methods=['POST'])
@jwt_required()
def save_quiz():
    """Save quiz results for the current user (protected route)"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get data from request body
    data = request.get_json()
    if not data or 'quiz_id' not in data or 'answers' not in data:
        return jsonify({'error': 'Quiz ID and answers are required'}), 400
    
    # Validate answers format
    if not isinstance(data['answers'], dict):
        return jsonify({'error': 'Answers must be a dictionary mapping universal_ids to values'}), 400
    
    # Prepare context for variable substitution if needed
    context = {
        'user_id': current_user_id,
        # Add other context variables that might be needed
    }
    
    # Add quiz_id to the context if it might be used in universal_ids
    if 'quiz_id' in data:
        context['quiz_id'] = data['quiz_id']
    
    # If there are any additional parameters that might be used in variable substitution, 
    # add them to the context
    if 'context' in data and isinstance(data['context'], dict):
        context.update(data['context'])
    
    # Add the answers dictionary to the context for <answer:qX> references
    # We can use the question_ids mapping sent from the frontend
    if 'question_ids' in data and isinstance(data['question_ids'], dict):
        # Create a dictionary with question_id as key and the corresponding answer as value
        answers_by_question_id = {}
        for universal_id, question_id in data['question_ids'].items():
            if universal_id in data['answers']:
                answers_by_question_id[question_id] = data['answers'][universal_id]
        
        context['answers'] = answers_by_question_id
        print(f"Added answers by question ID to context: {answers_by_question_id}")
    
    # As a fallback, also use raw_answers if provided (keyed directly by question_id)
    elif 'raw_answers' in data and isinstance(data['raw_answers'], dict):
        context['answers'] = data['raw_answers']
        print(f"Using raw answers by question ID: {data['raw_answers']}")
    
    # Try to identify and process simple variable-only universal IDs first
    # This helps ensure variables like <plate> are saved in context before processing other answers
    reordered_answers = {}
    variable_only_answers = {}
    
    for universal_id, value in data['answers'].items():
        if universal_id.startswith('<') and universal_id.endswith('>'):
            # This is a variable-only universal ID, save it first
            variable_only_answers[universal_id] = value
            # Also update context directly so future substitutions can use this value
            var_name = universal_id[1:-1]
            context[var_name] = value
            print(f"Pre-populating context with {var_name}={value}")
        else:
            # Regular universal ID, save it later
            reordered_answers[universal_id] = value
    
    # Print the context to log for debugging
    print(f"Context for variable substitution: {context}")
    
    # Save the variable-only universal IDs first
    if variable_only_answers:
        result = save_quiz_results(
            user_id=current_user_id,
            results=variable_only_answers,
            context=context
        )
        if not result['success']:
            # If saving the variables failed, return the error
            return jsonify({
                'success': False,
                'message': result['message'],
                'operations': result['operations']
            }), 500
    
    # Now save the remaining answers
    result = save_quiz_results(
        user_id=current_user_id,
        results=reordered_answers,
        context=context
    )
    
    # Get quiz data to process return address with substitutions
    processed_return_address = "/home"
    try:
        quiz_id = data['quiz_id']
        quiz_data = get_quiz_by_id(quiz_id)
        if quiz_data:
            # Get return address from quiz data
            quiz_json = json.loads(quiz_data['json']) if isinstance(quiz_data['json'], str) else quiz_data['json']
            return_address = quiz_json.get('return_address', '/home')
            
            # Check if the return address is a special variable like <return_override>
            if return_address.startswith('<') and return_address.endswith('>'):
                var_name = return_address[1:-1]
                if var_name in context:
                    # Use the overridden value directly
                    processed_return_address = context[var_name]
                    print(f"Using return_override: {processed_return_address}")
                else:
                    # Apply standard substitution
                    processed_return_address = _substitute_context(return_address, context)
            else:
                # Apply standard substitution
                processed_return_address = _substitute_context(return_address, context)
                
            print(f"Original return address: {return_address}")
            print(f"Processed return address: {processed_return_address}")
    except Exception as e:
        print(f"Error processing return address: {e}")
        # Use default if processing fails
    
    # Return the detailed results
    if not result['success']:
        # Some or all operations failed
        return jsonify({
            'success': False,
            'message': result['message'],
            'operations': result['operations']
        }), 500
    
    # All operations succeeded
    return jsonify({
        'success': True,
        'message': result['message'],
        'operations': result['operations'],
        'return_address': processed_return_address  # Add the processed return address to the response
    }), 200

# Carpool routes
@app.route('/api/carpool/reserve', methods=['POST'])
@jwt_required()
def reserve_carpool():
    """Reserve a new carpool listing ID for the current user (protected route)"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Create new carpool listing with just the driver_id
    carpool_id = reserve_carpool_listing_id(current_user_id)
    
    if not carpool_id:
        return jsonify({'error': 'Failed to reserve carpool listing ID'}), 500
    
    return jsonify({
        'message': 'Carpool listing ID reserved successfully',
        'carpool_id': carpool_id
    }), 201

@app.route('/api/carpool/get-full-listing', methods=['GET'])
@jwt_required()
def get_full_carpool_listing():
    """Get full details of a carpool listing including passengers."""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get carpool_id from query parameters
    carpool_id = request.args.get('carpool_id')
    if not carpool_id:
        return jsonify({'error': 'Carpool ID is required'}), 400
        
    try:
        carpool_id = int(carpool_id)
    except ValueError:
        return jsonify({'error': 'Invalid carpool ID format'}), 400
    
    # Get full carpool details
    carpool_details = get_full_carpool_details(carpool_id, current_user_id)
    
    if not carpool_details:
        return jsonify({'error': 'Carpool listing not found or you are not authorized to access it'}), 404
    
    return jsonify({
        'success': True,
        'carpool': carpool_details
    })

@app.route('/api/carpool/get-public-listing', methods=['GET'])
@jwt_required()
def get_public_carpool_listing():
    """Get a carpool's public information (less details than the full listing)"""
    # Get carpool_id from query parameters
    carpool_id = request.args.get('carpool_id')
    
    if not carpool_id:
        return jsonify({'error': 'Carpool ID is required'}), 400
    
    try:
        carpool_id = int(carpool_id)
    except ValueError:
        return jsonify({'error': 'Invalid Carpool ID format'}), 400
    
    # Get carpool data from database
    carpool_data = get_public_carpool_details(carpool_id)
    
    if not carpool_data:
        return jsonify({'error': 'Carpool not found'}), 404
    
    return jsonify({
        'success': True,
        'carpool': carpool_data
    })

@app.route('/api/carpools', methods=['GET'])
@jwt_required()
def get_carpools():
    """Get available carpools with optional filters"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Extract filters from request parameters
    filters = {}
    
    # Get location and date filters
    if request.args.get('pickup_location'):
        filters['pickup_location'] = request.args.get('pickup_location')
    
    if request.args.get('dropoff_location'):
        filters['dropoff_location'] = request.args.get('dropoff_location')
    
    if request.args.get('arrival_date'):
        filters['arrival_date'] = request.args.get('arrival_date')
    
    # If min seats specified
    if request.args.get('min_seats'):
        try:
            filters['min_seats'] = int(request.args.get('min_seats'))
        except ValueError:
            pass
    
    # If earliest pickup specified
    if request.args.get('earliest_pickup'):
        filters['earliest_pickup'] = request.args.get('earliest_pickup')
    
    # If latest arrival specified
    if request.args.get('latest_arrival'):
        filters['latest_arrival'] = request.args.get('latest_arrival')
    
    # Get filtered carpools from database
    carpools = get_carpool_list(filters if filters else None)
    
    return jsonify({
        'success': True,
        'carpools': carpools
    })

@app.route('/api/carpool/join', methods=['POST'])
@jwt_required()
def join_carpool():
    """Join an existing carpool as a passenger"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get data from request body
    data = request.get_json()
    if not data or 'carpool_id' not in data:
        return jsonify({
            'success': False,
            'error': 'missing_data',
            'message': 'Carpool ID is required'
        }), 400
    
    # Extract data from request
    carpool_id = data.get('carpool_id')
    pickup_location = data.get('pickup_location')
    dropoff_location = data.get('dropoff_location')
    
    # Build filters from request data
    filters = {}
    
    # Include pickup and dropoff locations in filters
    if pickup_location:
        filters['pickup_location'] = pickup_location
    
    if dropoff_location:
        filters['dropoff_location'] = dropoff_location
    
    # Include travel date if provided
    if 'arrival_date' in data:
        filters['arrival_date'] = data.get('arrival_date')
    
    # Include time constraints if provided
    if 'earliest_pickup' in data:
        filters['earliest_pickup'] = data.get('earliest_pickup')
    
    if 'latest_arrival' in data:
        filters['latest_arrival'] = data.get('latest_arrival')
    
    # Add the passenger to the carpool
    result = add_passenger_to_carpool(
        carpool_id=carpool_id,
        passenger_id=current_user_id,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        filters=filters
    )
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route('/api/carpool/user-role', methods=['GET'])
@jwt_required()
def get_user_carpool_role():
    """Get the current user's role in a specific carpool"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get carpool_id from query parameters
    carpool_id = request.args.get('carpool_id')
    
    if not carpool_id:
        return jsonify({'error': 'Carpool ID is required'}), 400
    
    try:
        carpool_id = int(carpool_id)
    except ValueError:
        return jsonify({'error': 'Invalid carpool ID format'}), 400
    
    # Get user's role in the carpool
    role = get_user_role_in_carpool(carpool_id, current_user_id)
    
    if not role['carpool_exists']:
        return jsonify({'error': 'Carpool not found'}), 404
    
    return jsonify({
        'success': True,
        'is_driver': role['is_driver'],
        'is_passenger': role['is_passenger']
    })

@app.route('/api/carpool/remove-passenger', methods=['POST'])
@jwt_required()
def remove_passenger():
    """Remove a passenger from a carpool (can be called by driver to kick or by passenger to leave)"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get data from request body
    data = request.get_json()
    if not data or 'carpool_id' not in data:
        return jsonify({'error': 'Carpool ID is required'}), 400
    
    try:
        carpool_id = int(data['carpool_id'])
    except ValueError:
        return jsonify({'error': 'Invalid carpool ID format'}), 400
    
    # Get passenger ID from request or use current user if not specified
    passenger_id = data.get('passenger_id', current_user_id)
    try:
        passenger_id = int(passenger_id)
    except ValueError:
        return jsonify({'error': 'Invalid passenger ID format'}), 400
    
    # Check if user has permission to remove this passenger
    role = get_user_role_in_carpool(carpool_id, current_user_id)
    
    if not role['carpool_exists']:
        return jsonify({'error': 'Carpool not found'}), 404
    
    # Allow removal only if:
    # 1. User is removing themselves (leaving) OR
    # 2. User is the driver (kicking someone else)
    if passenger_id != current_user_id and not role['is_driver']:
        return jsonify({'error': 'You do not have permission to remove this passenger'}), 403
    
    # Proceed with removing the passenger
    result = remove_passenger_from_carpool(carpool_id, passenger_id)
    
    if not result['success']:
        return jsonify({
            'success': False,
            'message': result['message']
        }), 400
    
    # Get updated carpool information
    carpool = get_full_carpool_details(carpool_id, current_user_id)
    
    return jsonify({
        'success': True,
        'message': result['message'],
        'carpool': carpool
    })

@app.route('/api/carpool/route-map', methods=['GET'])
@jwt_required()
def get_route_map_data():
    """Get route map data for a carpool with all waypoints for Google Maps integration"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Get carpool_id from query parameters
    carpool_id = request.args.get('carpool_id')
    
    if not carpool_id:
        return jsonify({'error': 'Carpool ID is required'}), 400
    
    try:
        carpool_id = int(carpool_id)
    except ValueError:
        return jsonify({'error': 'Invalid carpool ID format'}), 400
    
    # Check if user has permission to view this carpool's route
    role = get_user_role_in_carpool(carpool_id, current_user_id)
    
    if not role['carpool_exists']:
        return jsonify({'error': 'Carpool not found'}), 404
    
    # Only allow viewing if user is driver or passenger
    if not role['is_driver'] and not role['is_passenger']:
        return jsonify({'error': 'You do not have permission to view this carpool route'}), 403
    
    # Get carpool details to extract route information
    carpool_details = get_full_carpool_details(carpool_id, current_user_id)
    
    if not carpool_details:
        return jsonify({'error': 'Failed to retrieve carpool details'}), 500
    
    try:
        # Initialize Google Maps client
        from app.database import get_gmaps_client
        gmaps = get_gmaps_client()
        
        # Extract origin and destination addresses
        origin_address = carpool_details['route']['origin']
        destination_address = carpool_details['route']['destination']
        
        print(f"Geocoding origin address: {origin_address}")
        
        # Get geocoded origin and destination
        origin_geocode = gmaps.geocode(origin_address)
        if not origin_geocode:
            print(f"Failed to geocode origin address: {origin_address}")
            return jsonify({'error': f'Failed to geocode origin address: {origin_address}'}), 500
            
        print(f"Geocoding destination address: {destination_address}")
        destination_geocode = gmaps.geocode(destination_address)
        if not destination_geocode:
            print(f"Failed to geocode destination address: {destination_address}")
            return jsonify({'error': f'Failed to geocode destination address: {destination_address}'}), 500
        
        print(f"Successfully geocoded addresses")
        
        # Extract coordinates
        origin_location = {
            'lat': origin_geocode[0]['geometry']['location']['lat'],
            'lng': origin_geocode[0]['geometry']['location']['lng']
        }
        
        destination_location = {
            'lat': destination_geocode[0]['geometry']['location']['lat'],
            'lng': destination_geocode[0]['geometry']['location']['lng']
        }
        
        # Get waypoints from passengers' pickup and dropoff locations
        waypoints = []
        
        print(f"Processing {len(carpool_details['passengers'])} passengers for waypoints")
        
        for passenger in carpool_details['passengers']:
            # Add pickup location
            if passenger['pickup_location']:
                print(f"Geocoding pickup: {passenger['pickup_location']}")
                pickup_geocode = gmaps.geocode(passenger['pickup_location'])
                if pickup_geocode:
                    waypoints.append({
                        'lat': pickup_geocode[0]['geometry']['location']['lat'],
                        'lng': pickup_geocode[0]['geometry']['location']['lng'],
                        'label': f"Pickup: {passenger['full_name']}"
                    })
                else:
                    print(f"Failed to geocode pickup location: {passenger['pickup_location']}")
            
            # Add dropoff location
            if passenger['dropoff_location']:
                print(f"Geocoding dropoff: {passenger['dropoff_location']}")
                dropoff_geocode = gmaps.geocode(passenger['dropoff_location'])
                if dropoff_geocode:
                    waypoints.append({
                        'lat': dropoff_geocode[0]['geometry']['location']['lat'],
                        'lng': dropoff_geocode[0]['geometry']['location']['lng'],
                        'label': f"Dropoff: {passenger['full_name']}"
                    })
                else:
                    print(f"Failed to geocode dropoff location: {passenger['dropoff_location']}")
        
        return jsonify({
            'success': True,
            'route': {
                'origin': origin_location,
                'destination': destination_location,
                'waypoints': waypoints
            }
        })
        
    except Exception as e:
        print(f"Error generating route map data: {e}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500
    
@app.route('/api/carpools/my-carpools', methods=['GET'])
@jwt_required()
def get_my_carpools():
    """Get carpools where the current user is either a driver or passenger, with optional filtering"""
    # Get current user ID from JWT token
    current_user_id = int(get_jwt_identity())
    
    # Extract filters from request parameters
    role_filter = request.args.get('role', 'either')
    if role_filter not in ['driver', 'passenger', 'either']:
        role_filter = 'either'  # Default to 'either' if invalid role provided
    
    arrival_date = request.args.get('arrival_date')
    
    # Convert hide_past from string to boolean
    hide_past_param = request.args.get('hide_past', 'true')
    hide_past = hide_past_param.lower() == 'true'
    
    # Get user's carpools with filtering
    carpools = get_user_carpools(
        user_id=current_user_id,
        role_filter=role_filter,
        arrival_date=arrival_date,
        hide_past=hide_past
    )
    
    return jsonify({
        'success': True,
        'carpools': carpools
    })
    


    