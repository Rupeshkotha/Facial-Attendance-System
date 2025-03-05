import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  Download, 
  ChevronDown, 
  Calendar, 
  Menu, 
  X, 
  Camera, 
  UserPlus, 
  LogOut 
} from 'react-feather';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function Navbar({ onLogout }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrollBackground, setScrollBackground] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle scroll background effect
  useEffect(() => {
    const handleScroll = () => {
      // Add background when scrolled down
      if (window.scrollY > 50) {
        setScrollBackground(true);
      } else {
        setScrollBackground(false);
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      const response = await axios.get(`${BACKEND_URL}/download`, {
        params: { 
          start_date: formattedDate, 
          end_date: formattedDate 
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_${formattedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to download attendance file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const clearAttendance = async () => {
    try {
      await axios.post(`${BACKEND_URL}/clear_attendance`);
      alert("Attendance records cleared successfully");
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Failed to clear attendance", error);
      alert("Could not clear attendance records");
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const datePickerStyles = `
    .custom-datepicker-popper {
      z-index: 1050 !important;
    }
    
    .custom-datepicker-calendar {
      background-color: #34495e !important;
      color: white !important;
      border-radius: 10px !important;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
      border: none !important;
    }
    
    .custom-datepicker-calendar .react-datepicker__header {
      background-color: #2c3e50 !important;
      border-bottom: none !important;
    }
    
    .custom-datepicker-calendar .react-datepicker__day {
      color: white !important;
      transition: all 0.3s ease !important;
    }
    
    .custom-datepicker-calendar .react-datepicker__day:hover {
      background-color: #3498db !important;
      color: white !important;
    }
    
    .custom-datepicker-calendar .react-datepicker__day--selected {
      background-color: #27ae60 !important;
      color: white !important;
    }
    
    .custom-datepicker-calendar .react-datepicker__day--today {
      font-weight: bold !important;
      color: #3498db !important;
    }
  `;

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = datePickerStyles;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <nav 
      style={{
        ...styles.navbar,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: scrollBackground ? 'blur(10px)' : 'none',
        backgroundColor: scrollBackground 
          ? 'rgba(44, 62, 80, 0.9)' 
          : 'linear-gradient(135deg, #2c3e50, #34495e)',
        boxShadow: scrollBackground 
          ? '0 4px 15px rgba(0,0,0,0.3)' 
          : '0 4px 15px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
      }}
      ref={dropdownRef}
    >
      <div style={styles.logoContainer}>
        <Link to="/dashboard" style={styles.logo}>
          Attendance System
        </Link>
      </div>
      
      {/* Mobile Menu Toggle */}
      <div style={styles.mobileMenuToggle} onClick={toggleMobileMenu}>
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </div>
      
      {/* Desktop Navigation */}
      <div 
        style={{
          ...styles.navActions, 
          ...styles.desktopNavActions,
          display: isMobileMenuOpen ? 'none' : 'flex'
        }}
      >
        <Link 
          to="/camera" 
          style={{
            ...styles.navButton, 
            backgroundColor: location.pathname === '/camera' ? '#27ae60' : '#2980b9',
            transform: scrollBackground ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.3s ease'
          }}
        >
          <Camera size={16} style={styles.buttonIcon} />
          Camera
        </Link>
        
        <Link 
          to="/register" 
          style={{
            ...styles.navButton, 
            backgroundColor: location.pathname === '/register' ? '#27ae60' : '#2980b9'
          }}
        >
          <UserPlus size={16} style={styles.buttonIcon} />
          Register Face
        </Link>
        
        <div style={styles.dropdownContainer} ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
            style={{
              ...styles.navButton, 
              ...styles.dropdownTrigger,
              backgroundColor: isDropdownOpen ? '#27ae60' : '#2980b9'
            }}
          >
            <Download size={16} style={styles.buttonIcon} />
            Download 
            <ChevronDown size={16} style={styles.dropdownIcon} />
          </button>
          
          {isDropdownOpen && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownItem}>
                <Calendar size={16} style={styles.dropdownItemIcon} />
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  maxDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select Attendance Date"
                  customInput={
                    <input 
                      style={styles.datePicker} 
                      placeholder="Select Attendance Date" 
                    />
                  }
                  popperClassName="custom-datepicker-popper"
                  popperPlacement="bottom-end"
                  calendarClassName="custom-datepicker-calendar"
                />
              </div>
              
              <button 
                onClick={handleDownload} 
                disabled={isDownloading} 
                style={styles.dropdownButton}
              >
                {isDownloading ? 'Downloading...' : 'Download Attendance'}
              </button>
              
              <button 
                onClick={clearAttendance} 
                style={{...styles.dropdownButton, backgroundColor: '#f44336'}}
              >
                Clear Attendance
              </button>
            </div>
          )}
        </div>
        
        <button 
          onClick={onLogout} 
          style={{...styles.navButton, backgroundColor: '#f44336'}}
        >
          <LogOut size={16} style={styles.buttonIcon} />
          Logout
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div style={styles.mobileNavActions}>
          <Link 
            to="/camera" 
            style={{
              ...styles.mobileNavButton, 
              backgroundColor: location.pathname === '/camera' ? '#27ae60' : '#2980b9'
            }}
            onClick={toggleMobileMenu}
          >
            <Camera size={16} style={styles.buttonIcon} />
            Camera
          </Link>
          
          <Link 
            to="/register" 
            style={{
              ...styles.mobileNavButton, 
              backgroundColor: location.pathname === '/register' ? '#27ae60' : '#2980b9'
            }}
            onClick={toggleMobileMenu}
          >
            <UserPlus size={16} style={styles.buttonIcon} />
            Register Face
          </Link>
          
          <button 
            onClick={() => {
              toggleMobileMenu();
              onLogout();
            }} 
            style={{...styles.mobileNavButton, backgroundColor: '#f44336'}}
          >
            <LogOut size={16} style={styles.buttonIcon} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: 'linear-gradient(135deg, #2c3e50, #34495e)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    position: 'relative',
    zIndex: 1000,
    transition: 'background 0.3s ease',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    margin: 0,
    fontSize: '1.75rem',
    color: '#ecf0f1',
    textDecoration: 'none',
    fontWeight: 'bold',
    letterSpacing: '1px',
    transition: 'color 0.3s ease, transform 0.2s ease',
    ':hover': {
      color: '#3498db',
      transform: 'scale(1.05)',
    },
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  desktopNavActions: {
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    padding: '0.6rem 1.2rem',
    backgroundColor: '#2980b9',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    position: 'relative',
    overflow: 'hidden',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      backgroundColor: '#3498db',
    },
    ':active': {
      transform: 'translateY(1px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    },
  },
  activeNavButton: {
    backgroundColor: '#27ae60',
    transform: 'scale(1.05)',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
  },
  mobileMenuToggle: {
    display: 'none',
    color: '#ecf0f1',
    cursor: 'pointer',
    transition: 'transform 0.3s ease',
    ':hover': {
      transform: 'rotate(90deg)',
    },
    '@media (max-width: 768px)': {
      display: 'block',
    },
  },
  mobileNavActions: {
    display: 'none',
    '@media (max-width: 768px)': {
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      top: '100%',
      left: 0,
      width: '100%',
      background: 'linear-gradient(135deg, #2c3e50, #34495e)',
      padding: '1rem',
      gap: '1rem',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      zIndex: 999,
    },
  },
  mobileNavButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#2980b9',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.3s ease',
    fontWeight: '500',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    ':hover': {
      backgroundColor: '#3498db',
      transform: 'translateY(-2px)',
    },
  },
  buttonIcon: {
    marginRight: '0.5rem',
    transition: 'transform 0.2s ease',
    ':hover': {
      transform: 'rotate(15deg)',
    },
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: '#34495e',
    color: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    padding: '1rem',
    minWidth: '250px',
    zIndex: 1001,
    transition: 'all 0.3s ease',
    ':hover': {
      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
    },
  },
  dropdownButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#2980b9',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '0.5rem',
    ':hover': {
      backgroundColor: '#3498db',
    },
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '0.5rem',
  },
  dropdownItemIcon: {
    color: '#3498db',
    marginRight: '0.5rem',
  },
  datePicker: {
    padding: '0.75rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontWeight: '500',
    ':focus': {
      borderColor: '#3498db',
      boxShadow: '0 0 0 2px rgba(52, 152, 219, 0.3)',
    },
    '::placeholder': {
      color: 'rgba(255,255,255,0.5)',
    },
  },
};

export default Navbar;