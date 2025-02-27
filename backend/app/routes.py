from flask import jsonify, request
from app import app, bcrypt
from app.database import (
    create_user, get_user_by_id,
    get_user_by_username, get_user_by_email
)
from flask_jwt_extended import (
    create_access_token, get_jwt_identity,
    jwt_required
)

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

# the following routes are for testing purposes
# they should be removed eventually

@app.route('/api/test/users/<int:user_id>', methods=['GET'])
def get_user_info(user_id):
    try:
        user = get_user_by_id(user_id)
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'user': user})
    except Exception as e:
        return jsonify({'error': str(e)}), 500