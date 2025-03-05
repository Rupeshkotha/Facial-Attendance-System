# Face Recognition Attendance System 🧔📸

## 🌟 Project Overview
An intelligent attendance management system that leverages advanced face recognition technology to automate and streamline attendance tracking for educational institutions and organizations.

## ✨ Features
- Real-time face detection and recognition
- Secure user authentication
- Automated attendance marking
- Comprehensive attendance records
- User-friendly web interface

## 🛠 Technologies
- **Backend**: Python, Flask
- **Frontend**: React.js
- **Database**: MongoDB
- **Computer Vision**: OpenCV, Face Recognition
- **Authentication**: JWT

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- MongoDB
- pip
- npm

### Backend Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/face-recognition-attendance.git

# Navigate to backend directory
cd face-recognition-attendance/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run the backend server
python app.py
```

###Frontend Setup
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your backend URL

# Start the React development server
npm start
```
🔐 Environment Configuration
Create .env files in both backend and frontend directories
Use .env.example as a template
Never commit sensitive information to version control
📦 Key Dependencies
Flask
React
OpenCV
face-recognition
pymongo
jwt-extended
