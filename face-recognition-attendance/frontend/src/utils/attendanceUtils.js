import axios from '../utils/axiosConfig';

export const manageFaceRecognitionList = {
    // Modify setUserEmail to use the user object from localStorage
    setUserEmail: () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.email) {
          localStorage.setItem('user_email', user.email);
          console.log('User email automatically set:', user.email);
          return user.email;
        }
        return null;
    },
      
    addFace: (recognizedFace) => {
      try {
        // Validate input
        if (!recognizedFace || !recognizedFace.name || !recognizedFace.roll_number) {
          console.warn('Invalid recognized face data:', recognizedFace);
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Automatically set user email if not set
        let userEmail = localStorage.getItem('user_email');
        if (!userEmail) {
          userEmail = manageFaceRecognitionList.setUserEmail();
        }
        
        if (!userEmail) {
          console.error('No user email found. Cannot add face.');
          return;
        }
        
        const storageKey = `attendanceData_${userEmail}`;
        const storedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        // Initialize today's data if not exists
        if (!storedData[today]) {
          storedData[today] = [];
        }
    
        // Check for duplicate using both name and roll number
        const isDuplicate = storedData[today].some(
          face => 
            face.roll_number === recognizedFace.roll_number || 
            face.name === recognizedFace.name
        );
    
        if (!isDuplicate) {
          const newEntry = {
            ...recognizedFace,
            timestamp: new Date().toLocaleString(),
            // Add additional metadata if needed
            confidence: recognizedFace.confidence || 0,
            status: recognizedFace.status || 'Recognized'
          };
          
          storedData[today].push(newEntry);
          
          // Limit to last 50 entries per day to prevent excessive storage
          if (storedData[today].length > 50) {
            storedData[today] = storedData[today].slice(-50);
          }
          
          localStorage.setItem(storageKey, JSON.stringify(storedData));
          
          console.log('Face added successfully:', newEntry);
          return newEntry;
        } else {
          console.log('Duplicate face, not added:', recognizedFace);
        }
      } catch (error) {
        console.error('Error in addFace:', error);
      }
    },
  
    getTodaysFaces: () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const userEmail = localStorage.getItem('user_email');
        
        if (!userEmail) {
          console.warn('No user email found. Returning empty list.');
          return [];
        }
        
        const storageKey = `attendanceData_${userEmail}`;
        const storedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        const todaysFaces = storedData[today] || [];
        
        // Sort faces by timestamp, most recent first
        return todaysFaces.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
      } catch (error) {
        console.error('Error in getTodaysFaces:', error);
        return [];
      }
    },
  
    deleteAttendance: async (rollNumber) => {
        try {
          // Validate input
          if (!rollNumber) {
            console.error('Invalid roll number for deletion');
            return false;
          }
      
          const userEmail = localStorage.getItem('user_email');
          const token = localStorage.getItem('token');
      
          if (!userEmail || !token) {
            console.error('No user email or token found. Cannot delete attendance.');
            return false;
          }
      
          const fullUrl = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/delete_attendance`;
      
          const response = await axios.post(
            fullUrl, 
            { 
              roll_number: rollNumber
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 second timeout
            }
          );
          
          // Check for successful deletion
          const isSuccessful = 
            response.data.status === 'success' || 
            response.status === 200;
      
          if (isSuccessful) {
            // Local storage cleanup
            const today = new Date().toISOString().split('T')[0];
            const storageKey = `attendanceData_${userEmail}`;
            const storedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            if (storedData[today]) {
              const initialLength = storedData[today].length;
              
              storedData[today] = storedData[today].filter(
                face => face.roll_number !== rollNumber
              );
              
              const deletedCount = initialLength - storedData[today].length;
              
              localStorage.setItem(storageKey, JSON.stringify(storedData));
              
              console.log(`Deleted ${deletedCount} attendance record(s) for roll number ${rollNumber}`);
            }
            
            return true;
          } else {
            console.error('Delete attendance failed:', response.data);
            return false;
          }
        } catch (error) {
          console.error('Unexpected error in deleteAttendance:', error);
          return false;
        }
      },
      cleanupOldData: (daysToKeep = 7) => {
      try {
        const userEmail = localStorage.getItem('user_email');
        if (!userEmail) return;
        
        const storageKey = `attendanceData_${userEmail}`;
        const storedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const today = new Date();
        
        let removedDates = 0;
        
        Object.keys(storedData).forEach(date => {
          const dayDifference = (today - new Date(date)) / (1000 * 3600 * 24);
          if (dayDifference > daysToKeep) {
            delete storedData[date];
            removedDates++;
          }
        });
    
        localStorage.setItem(storageKey, JSON.stringify(storedData));
        
        console.log(`Cleaned up ${removedDates} old attendance records`);
      } catch (error) {
        console.error('Cleanup Old Data Error:', error);
      }
    }
};