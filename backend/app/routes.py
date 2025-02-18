from app import app
from flask import render_template

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/hello')
def hello():
    return {'message': 'Hello, World!'}

@app.route('/hello/<name>')
def hello_name(name):
    return {'message': f'Hello, {name}!'}