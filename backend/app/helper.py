import re
from flask import jsonify

def is_valid_email(email):
    # Define a regular expression for validating an email
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

def is_valid_password(password):
    # Define a regular expression for validating a password
    password_regex = r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$' # min 8 characters, with at least one letter and one digit
    return re.match(password_regex, password) is not None