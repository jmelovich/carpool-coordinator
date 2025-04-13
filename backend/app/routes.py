from flask import jsonify, request, g
from app import app, bcrypt
from app.database import (
    create_user, get_user_by_id,
    get_user_by_username, get_user_by_email,
    get_quiz_by_id, save_quiz_results, get_specific_user_data, init_app, _substitute_context,
    reserve_carpool_listing_id
)
from flask_jwt_extended import (
    JWTManager, jwt_required, create_access_token, get_jwt_identity
)
from app.helper import is_valid_email, is_valid_password
import json
from datetime import datetime, timedelta

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
        quiz_json = json.loads(quiz_data['json'])
        universal_ids = [question.get('universal_id') for question in quiz_json.get('questions', [])]
        
        # Get existing answers for these universal_ids
        existing_answers = get_specific_user_data(current_user_id, universal_ids)
        
        # Return quiz data along with existing answers
        return jsonify({
            'quiz_id': quiz_data['quiz_id'],
            'json': quiz_data['json'],
            'return_address': quiz_data['return_address'],
            'existing_answers': existing_answers
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Failed to parse quiz data'}), 500

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
    
    # Print the context to log for debugging
    print(f"Context for variable substitution: {context}")
    
    # Save quiz results to appropriate locations based on universal_ids
    result = save_quiz_results(
        user_id=current_user_id,
        results=data['answers'],
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
            
            # Apply substitution for variables in return_address using our existing function
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
    


    