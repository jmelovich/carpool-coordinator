import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import background from './assets/register_backdrop.png';
import './styles/register.css';

function Register({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [message, setMessage] = useState(null);
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (password) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(password);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validatePassword(formData.password)) {
      setPasswordError("Password must include at least 8 characters, with at least one letter and one number.");
      return;
    } else {
      setPasswordError('');
    }

    const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (response.ok) {
      Cookies.set('access_token', data.access_token);
      setIsAuthenticated(true);
      setMessage({ type: "success", text: 'User registered successfully!' });
      navigate('/home');
    } else {
      setMessage({ type: "error", text: data.error });
    }
  };

  const alertStyle = message?.type === 'success'
    ? { backgroundColor: '#d1fae5', color: '#065f46' }
    : { backgroundColor: '#fee2e2', color: '#991b1b' };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      backgroundImage: `url(${background})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: '30px',
      paddingLeft: '20vw',
      paddingRight: '20vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.25)', // Adjust the 0.4 for more/less darkness
        zIndex: 1
      }} />
      <div style={{
        position: 'relative',
        zIndex: 2,
        backgroundColor: 'rgba(32, 56, 17, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '20px'
      }}>
        <h2 className="raleway-text" style={{ fontSize: '28px', margin: '0 auto', padding: '5px'}}>Create a new account</h2>

        {message && (
          <div style={{ ...alertStyle, padding: '10px 14px', borderRadius: '6px', fontSize: '14px', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSignup} className="register-form" style={{ gap: '16px' }}>
          <input
            type="text"
            name="username"
            placeholder="USERNAME"
            value={formData.username}
            onChange={handleChange}
            className="register-input input-white-placeholder"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="EMAIL"
            value={formData.email}
            onChange={handleChange}
            className="register-input input-white-placeholder"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="PASSWORD"
            value={formData.password}
            onChange={handleChange}
            className="register-input input-white-placeholder"
            required
          />

          {passwordError && <p className="text-red-500 text-sm text-center">{passwordError}</p>}

          <button type="submit" className="form-button">
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;
