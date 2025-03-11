import re
from flask import jsonify

def is_valid_email(email):
    # Define a regular expression for validating an email
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

def is_valid_password(password):
    # Define a regular expression for validating a password
    password_regex = r'^[a-zA-Z]+[0-9]+$' # any amount of alphabetical characters followed up with any amount of numbers
    return re.match(password_regex, password) is not None