from flask import Blueprint, request, jsonify, make_response
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import re
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB Setup
client = MongoClient(os.getenv('MONGODB_URI'))
db = client[os.getenv('MONGODB_DB_NAME')]
users_collection = db['users']

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()
jwt = JWTManager()

def validate_email(email):
    """Email validation regex"""
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register():
    # Handle OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response, 204

    # Handle POST request
    data = request.json
    
    # Validate input
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    # Comprehensive validation
    if not name or len(name) < 2:
        return jsonify({"error": "Name must be at least 2 characters"}), 400
    
    if not email or not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    
    if not password or len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    
    # Check if user already exists
    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "Email already registered"}), 409
    
    # Hash password
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    # Create user document
    user_data = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "created_at": datetime.utcnow(),
        "sessions_count": 0,
        "last_login": None
    }
    
    # Insert user
    result = users_collection.insert_one(user_data)
    
    return jsonify({
        "message": "User registered successfully",
        "user_name": name,
        "user_email": email
    }), 201

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    # Handle OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response, 204

    # Handle POST request
    data = request.json
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    # Find user
    user = users_collection.find_one({"email": email})
    
    if not user:
        return jsonify({"error": f"Email {email} is not registered. Please register first."}), 401
    
    # Check password
    if not bcrypt.check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Create access token
    access_token = create_access_token(
        identity=email,  # Changed to use email instead of ObjectId
        expires_delta=timedelta(days=30)  # Extended token expiration
    )
    
    # Update last login and increment sessions count
    users_collection.update_one(
        {"_id": user['_id']}, 
        {
            "$set": {"last_login": datetime.utcnow()},
            "$inc": {"sessions_count": 1}
        }
    )
    
    return jsonify({
        "access_token": access_token,
        "user_name": user['name'],
        "user_email": user['email']
    }), 200

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_email = get_jwt_identity()
    
    user = users_collection.find_one({"email": current_user_email})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({
        "name": user['name'],
        "email": user['email'],
        "sessions_count": user.get('sessions_count', 0),
        "last_login": user.get('last_login')
    }), 200