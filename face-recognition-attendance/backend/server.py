from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import numpy as np
import face_recognition
from datetime import datetime, timedelta
import logging
import cv2
import base64
import io
from pymongo import MongoClient
from PIL import Image
import os
from dotenv import load_dotenv
import pymongo
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from flask_bcrypt import Bcrypt
from auth import auth_bp
from bson import ObjectId
import hashlib
import functools

# Load environment variables
load_dotenv()

# Constants
FACE_MATCH_THRESHOLD = 0.6

def validate_env_config():
    """Validate environment configuration"""
    required_vars = ['MONGODB_URI', 'MONGODB_DB_NAME', 'JWT_SECRET_KEY']
    for var in required_vars:
        if not os.getenv(var):
            logging.error(f"Missing required environment variable: {var}")
            raise ValueError(f"Environment variable {var} is required")

# Validate environment configuration
validate_env_config()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@app.route('/', methods=['OPTIONS'])
@app.route('/register', methods=['OPTIONS'])
@app.route('/download', methods=['OPTIONS'])
@app.route('/clear_attendance', methods=['OPTIONS'])
def handle_options():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE')
    return response, 204

# JWT and Bcrypt configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)  # Extended to 30 days
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# Register authentication blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Logging setup
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Modify the MongoDB Connection section
try:
    # Get MongoDB URI and Database Name from environment variables
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
    MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'attendance_system')
    
    # Connect to MongoDB with enhanced connection settings
    client = MongoClient(
        MONGODB_URI, 
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000
    )
    client.server_info()  # Force connection to verify
    
    # Global database for user management
    global_db = client[MONGODB_DB_NAME]
    
    # Collections
    users_collection = global_db['users']
    students_collection = global_db['students']
    attendance_collection = global_db['attendance']
    
    # Create indexes for data integrity and performance
    users_collection.create_index('email', unique=True, background=True)
    students_collection.create_index([('user_id', 1), ('roll_number', 1)], unique=True, background=True)
    attendance_collection.create_index([
        ('user_id', 1), 
        ('student_id', 1), 
        ('timestamp', -1)
    ], unique=True, background=True)
    
    # Log successful connection
    logger.info(f"Connected to MongoDB: {MONGODB_URI}")
    logger.info(f"Global Database: {MONGODB_DB_NAME}")

except pymongo.errors.ConnectionFailure as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    raise SystemExit(1)
except Exception as e:
    logger.error(f"Unexpected MongoDB Connection Error: {e}")
    raise

def get_current_user_id(email):
    """
    Retrieve the user's ObjectId based on email
    Creates a new user if not exists
    """
    user = users_collection.find_one({'email': email})
    
    if not user:
        # Create a new user if not exists
        user_data = {
            '_id': ObjectId(),
            'email': email,
            'created_at': datetime.now()
        }
        user_id = users_collection.insert_one(user_data).inserted_id
    else:
        user_id = user['_id']
    
    return user_id

def get_teacher_email_from_token():
    """
    Attempt to get teacher email from JWT token
    """
    try:
        # First, try to get email from JWT token
        current_user_email = get_jwt_identity()
        if current_user_email:
            logger.info(f"Retrieved email from JWT token: {current_user_email}")
            return current_user_email
    except Exception as e:
        logger.error(f"JWT Token Identity Error: {e}")
    
    # If no JWT token, raise an error
    raise ValueError("No valid authentication token found. Please log in again.")

def preprocess_image_from_file(file):
    """
    Preprocess an image from file object using OpenCV
    """
    try:
        # Read image from file object
        file_bytes = file.read()
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Could not decode image")
            return None
        
        # Convert to RGB
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        return rgb_img
    
    except Exception as e:
        logger.error(f"Image preprocessing error: {str(e)}")
        return None

def encode_image(img):
    """
    Encode image to base64
    """
    try:
        # Convert RGB image to PIL Image
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        
        # Save to bytes buffer
        buffer = io.BytesIO()
        pil_img.save(buffer, format="JPEG")
        
        # Encode to base64
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Image encoding error: {str(e)}")
        return None


@app.route('/register', methods=['POST', 'OPTIONS'])
@jwt_required()  # Add JWT authentication
def register_face():
    # Handle OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response, 204
    
    try:
        # Get current user email from JWT token
        current_user_email = get_jwt_identity()
        logger.info(f"Registering student for user: {current_user_email}")
        
        # Validate image
        if 'image' not in request.files:
            return jsonify({"error": "No image uploaded"}), 400
        
        # Get additional details
        name = request.form.get('name', '').strip()
        roll_number = request.form.get('roll_number', '').strip()
        
        # Validate input
        if not name or not roll_number:
            return jsonify({
                "error": "Name and Roll Number are required"
            }), 400
        
        # Preprocess image with enhanced error handling
        file = request.files['image']
        rgb_array = preprocess_image_from_file(file)
        
        if rgb_array is None:
            return jsonify({
                "error": "Could not process the uploaded image"
            }), 400
        
        # Detect faces with logging
        face_locations = face_recognition.face_locations(rgb_array)
        
        if not face_locations:
            logger.error("No face detected in the image")
            return jsonify({
                "error": "No face detected in the image. Please ensure a clear face photo."
            }), 400
        
        # Get face encodings
        face_encodings = face_recognition.face_encodings(rgb_array, face_locations)
        
        if not face_encodings:
            logger.error("Could not extract face encoding")
            return jsonify({
                "error": "Could not extract face features. Try a different image."
            }), 400
        
        # Get current user ID
        current_user_id = get_current_user_id(current_user_email)
        
        # Prepare student data with user_id
        student_data = {
            'user_id': current_user_id,  # CRITICAL: Link student to user
            'name': name,
            'roll_number': roll_number,
            'face_encoding': face_encodings[0].tolist(),
            'registered_at': datetime.now()
        }
        
        # Insert or update in global students collection
        result = students_collection.update_one(
            {'user_id': current_user_id, 'roll_number': roll_number},
            {'$set': student_data},
            upsert=True
        )
        
        logger.info(f"Student registered/updated: {name} (Roll: {roll_number})")
        
        return jsonify({
            "status": "success",
            "message": "Student registered successfully",
            "name": name,
            "roll_number": roll_number
        }), 200
    
    except Exception as e:
        logger.error(f"Student registration error: {e}")
        return jsonify({
            "error": "Unexpected error during registration",
            "details": str(e)
        }), 500

@app.route('/recognize', methods=['POST', 'OPTIONS'])
@jwt_required()
def recognize():
    # Handle OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response, 204
    
    try:
        # Get current user email from token
        current_user_email = get_teacher_email_from_token()
        logger.info(f"Current user email: {current_user_email}")
        
        # Get current user ID
        current_user_id = get_current_user_id(current_user_email)
        logger.info(f"Current user ID: {current_user_id}")

        # Fetch ONLY students registered by THIS user
        registered_students = list(students_collection.find({
            'user_id': current_user_id,  # CRITICAL: STRICT user_id filter
            'face_encoding': {'$exists': True}  # Ensure face encoding exists
        }))

        logger.info(f"Received recognition request for user: {current_user_email}")
        logger.info(f"Number of registered students: {len(registered_students)}")
        
        # Check if image is uploaded
        if 'image' not in request.files:
            logger.error("No image uploaded")
            return jsonify({"error": "No image uploaded"}), 400
        
        file = request.files['image']
        
        # Preprocess image
        rgb_array = preprocess_image_from_file(file)
        
        if rgb_array is None:
            logger.error("Could not process uploaded image")
            return jsonify({"error": "Could not process uploaded image"}), 400
        
        # Detect faces
        face_locations = face_recognition.face_locations(rgb_array)
        face_encodings = face_recognition.face_encodings(rgb_array, face_locations)
        
        if not face_encodings:
            logger.error("No face detected in image")
            return jsonify({"error": "No face detected in image"}), 400
        
        logger.info(f"Registered students found for this user: {len(registered_students)}")
        
        if not registered_students:
            logger.error("No registered students found for this user")
            return jsonify({
                "error": "No registered students found. Please register students first.",
                "user_id": str(current_user_id)
            }), 404
        
        # Prepare known face data
        known_face_encodings = []
        known_face_names = []
        known_face_roll_numbers = []
        known_face_student_ids = []
        
        # Explicitly validate and prepare student data
        for student in registered_students:
            # CRITICAL: Double-check user_id to prevent any cross-user data leak
            if student.get('user_id') == current_user_id and 'face_encoding' in student:
                known_face_encodings.append(np.array(student['face_encoding']))
                known_face_names.append(student['name'])
                known_face_roll_numbers.append(student['roll_number'])
                known_face_student_ids.append(student['_id'])
        
        logger.info(f"Validated known face encodings: {len(known_face_encodings)}")
        
        # If no valid face encodings found
        if not known_face_encodings:
            logger.error("No valid face encodings found for this user")
            return jsonify({
                "error": "No valid student face encodings. Please re-register students.",
                "user_id": str(current_user_id)
            }), 404
        
        # Recognize faces with strict matching
        for face_encoding in face_encodings:
            best_match = None
            best_confidence = 0
            
            # Compare against ALL known face encodings for THIS user
            for idx, known_encoding in enumerate(known_face_encodings):
                # Calculate face distance
                face_distance = face_recognition.face_distance([known_encoding], face_encoding)[0]
                confidence = 1 - face_distance
                
                # ULTRA STRICT matching criteria
                if confidence > 0.5 and confidence > best_confidence:
                    best_match = idx
                    best_confidence = confidence
                # If NO match found for ANY face encoding
            if best_match is None:
                logger.warning("No matching student found for the face")
                return jsonify({
                    "status": "error",
                    "message": "This face is not registered in your account. Please register the student first.",
                    "details": {
                        "registered_students_count": len(known_face_encodings),
                        "best_confidence": float(best_confidence)
                    }
                }), 404
                
                
            
            # If a good match is found ONLY for this user's students
            if best_match is not None:
                name = known_face_names[best_match]
                roll_number = known_face_roll_numbers[best_match]
                student_id = known_face_student_ids[best_match]
                
                # ADDITIONAL VERIFICATION: Verify student belongs to current user
                student = students_collection.find_one({
                    '_id': student_id,
                    'user_id': current_user_id
                })
                
                if not student:
                    logger.error(f"Attempted to recognize student not belonging to user {current_user_id}")
                    continue
                
                # Get today's date
                today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                tomorrow = today + timedelta(days=1)
                
                # Check for existing attendance today
                existing_attendance = attendance_collection.find_one({
                    'user_id': current_user_id,  # STRICT user_id filter
                    'student_id': student_id,
                    'timestamp': {
                        '$gte': today,
                        '$lt': tomorrow
                    }
                })
                
                # If attendance not already marked
                if not existing_attendance:
                    # Mark attendance
                    attendance_record = {
                        'user_id': current_user_id,  # STRICT user_id filter
                        'student_id': student_id,
                        'name': name,
                        'roll_number': roll_number,
                        'timestamp': datetime.now()
                    }
                    attendance_collection.insert_one(attendance_record)
                
                logger.info(f"Recognized student: {name}, Roll: {roll_number}")
                
                return jsonify({
                    "name": name,
                    "roll_number": roll_number,
                    "confidence": float(best_confidence),
                    "status": "Attendance marked" if not existing_attendance else "Already marked"
                }), 200
        
        # If no match found
        logger.warning("No matching student found")
        return jsonify({
            "name": "UNKNOWN",
            "status": "not recognized"
        }), 404
    
    except Exception as e:
        logger.error(f"Full Recognition Error: {str(e)}")
        logger.error(f"Error Type: {type(e)}")
        
        # More detailed error response
        return jsonify({
            "error": "Failed to recognize face",
            "details": str(e),
            "user_id": str(current_user_id) if 'current_user_id' in locals() else 'Unknown'
        }), 500
# Modify download and clear attendance routes similarly
@app.route('/download', methods=['GET'])
@jwt_required()
def download_csv():
    try:
        # Get current user email
        current_user_email = get_teacher_email_from_token()
        
        # Get current user ID
        current_user_id = get_current_user_id(current_user_email)
        
        # Get date parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Parse dates
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                end_date = end_date.replace(hour=23, minute=59, second=59)
            except ValueError:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        else:
            # Default to today's date if no date range provided
            today = datetime.now()
            start_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = today.replace(hour=23, minute=59, second=59)
        
        # Fetch attendance records within date range for this user
        attendance_records = list(attendance_collection.find({
            'user_id': current_user_id,
            'timestamp': {'$gte': start_date, '$lte': end_date}
        }))
        
        # Create CSV in memory
        output = io.StringIO()
        output.write("Name,Roll Number,Timestamp\n")
        
        for record in attendance_records:
            output.write(f"{record['name']},{record['roll_number']},{record['timestamp']}\n")
        
        # Create file-like object
        output.seek(0)
        
        # Generate filename with date range
        filename = f"Attendance_{start_date.strftime('%Y-%m-%d')}_{end_date.strftime('%Y-%m-%d')}.csv"
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')), 
            mimetype='text/csv',
            as_attachment=True, 
            download_name=filename
        )
    except Exception as e:
        logger.error(f"Error downloading CSV: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Could not download attendance file"
        }), 500

@app.route('/delete_attendance', methods=['POST'])
@jwt_required()
def delete_attendance():
    try:
        # Get current user email from JWT token
        current_user_email = get_jwt_identity()
        current_user_id = get_current_user_id(current_user_email)
        
        # Get data from request
        data = request.get_json()
        roll_number = data.get('roll_number')
        
        # Validate input
        if not roll_number:
            return jsonify({
                'status': 'error', 
                'message': 'Roll number is required'
            }), 400
        
        # Get today's date range
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        # Find the student with this roll number for the current user
        student = students_collection.find_one({
            'user_id': current_user_id,
            'roll_number': roll_number
        })
        
        if not student:
            return jsonify({
                'status': 'error', 
                'message': 'Student not found'
            }), 404
        
        # Delete attendance record
        result = attendance_collection.delete_one({
            'user_id': current_user_id,
            'student_id': student['_id'],
            'timestamp': {
                '$gte': today,
                '$lt': tomorrow
            }
        })
        
        if result.deleted_count > 0:
            logger.info(f"Attendance deleted for student {roll_number}")
            return jsonify({
                'status': 'success', 
                'message': 'Attendance deleted successfully'
            }), 200
        else:
            return jsonify({
                'status': 'error', 
                'message': 'No attendance record found for today'
            }), 404
    
    except Exception as e:
        logger.error(f"Delete Attendance Error: {str(e)}")
        return jsonify({
            'status': 'error', 
            'message': 'Internal server error',
            'details': str(e)
        }), 500
        
@app.route('/clear_attendance', methods=['POST'])
@jwt_required()
def clear_attendance():
    try:
        # Get current user email
        current_user_email = get_teacher_email_from_token()
        
        # Get current user ID
        current_user_id = get_current_user_id(current_user_email)
        
        # Get today's date (start of the day)
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Delete only today's attendance records for this user
        result = attendance_collection.delete_many({
            'user_id': current_user_id,
            'timestamp': {'$gte': today}
        })
        
        logger.info(f"Today's attendance records cleared for user {current_user_id}. {result.deleted_count} records removed.")
        return jsonify({
            "status": "success",
            "message": f"{result.deleted_count} today's attendance records cleared"
        })
    except Exception as e:
        logger.error(f"Error clearing attendance: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Could not clear attendance"
        }), 500
@app.route('/')
def home():
    return jsonify({
        "message": "Face Recognition Attendance System Backend",
        "available_endpoints": [
            "/recognize - Recognize faces",
            "/register - Register new faces",
            "/download - Download attendance CSV",
            "/clear_attendance - Clear attendance records"
        ]
    })

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)