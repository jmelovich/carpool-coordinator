from flask import jsonify, request, g
from app import app, bcrypt
from app.database import (
    create_user, get_user_by_id,
    get_user_by_username, get_user_by_email,
    get_quiz_by_id, save_quiz_results, get_specific_user_data, init_app, _substitute_context,
    reserve_carpool_listing_id, get_full_carpool_details, get_public_carpool_details,
    check_user_missing_info, get_options_from_universal_id, get_user_full_profile, delete_car,
    get_carpool_list
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
    
    # If min seats specified
    if request.args.get('min_seats'):
        try:
            filters['min_seats'] = int(request.args.get('min_seats'))
        except ValueError:
            pass
    
    # If earliest departure specified
    if request.args.get('earliest_departure'):
        filters['earliest_departure'] = request.args.get('earliest_departure')
    
    # If latest arrival specified
    if request.args.get('latest_arrival'):
        filters['latest_arrival'] = request.args.get('latest_arrival')
    
    # Get max distance if specified
    if request.args.get('max_distance'):
        try:
            filters['max_distance'] = float(request.args.get('max_distance'))
        except ValueError:
            pass
    
    # Get filtered carpools from database
    carpools = get_carpool_list(filters if filters else None)
    
    return jsonify({
        'success': True,
        'carpools': carpools
    })
    


    