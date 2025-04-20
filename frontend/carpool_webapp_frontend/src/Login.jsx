import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

import './styles/login.css';
import background from './assets/login_backdrop.png';

function Login({ setIsAuthenticated }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (response.ok) {
      Cookies.set('access_token', data.access_token, { expires: 7 });
      setIsAuthenticated(true);
      setMessage({ type: 'success', text: 'Login successful!' });
      navigate('/home');
    } else {
      setMessage({ type: 'error', text: data.error });
    }
  };

  const alertStyle = message?.type === 'success'
    ? { backgroundColor: '#d1fae5', color: '#065f46' }
    : { backgroundColor: '#fee2e2', color: '#991b1b' };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      minHeight: '100vh',
      backgroundImage: `url(${background})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      boxSizing: 'border-box',
      overflow: 'hidden'
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
        maxWidth: '320px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <h1 className="raleway-text" style={{ fontSize: '28px' }}>Welcome back!</h1>

        {message && (
          <div style={{ ...alertStyle, padding: '10px 14px', marginBottom: '10px', borderRadius: '6px', fontSize: '14px', textAlign: 'center', width: '100%' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="text"
            name="username"
            placeholder="USERNAME"
            value={formData.username}
            onChange={handleChange}
            className="form-input input-white-placeholder"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="PASSWORD"
            value={formData.password}
            onChange={handleChange}
            className="form-input input-white-placeholder"
            required
          />
          <button type="submit" className="form-button">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;