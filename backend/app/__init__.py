from flask import Flask, jsonify
from config import Config
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
import datetime
import os

app = Flask(__name__)
app.config.from_object(Config)

# Set a secure secret key for JWT
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'SECRET_KEY_HERE')  # this should be changed later
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(hours=1)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

# Initialize extensions
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# JWT error handlers
@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({
        'error': 'Invalid token',
        'message': str(error)
    }), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    return jsonify({
        'error': 'Token has expired',
        'message': 'Please log in again'
    }), 401

from app import routes 