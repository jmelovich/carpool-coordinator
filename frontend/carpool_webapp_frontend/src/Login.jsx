import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import './styles/styles.css';
import background from './assets/green_splash.png';

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
    console.log('Logging in with:', formData.username, formData.password);

    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Success! Returned token is:', data.access_token);
      console.log('User id is:', data.user.id);
      console.log('User is:', data.user.username);
      
      // Store the access token in a cookie
      Cookies.set('access_token', data.access_token, { expires: 7 }); // Cookie expires in 7 days
      setIsAuthenticated(true);
      setMessage({ type: "success", text: 'Login successful!' });
      navigate('/home');
    } else {
      console.log('Error:', data.error);
      setMessage({ type: "error", text: data.error });
    }
  };

    return (
    <div style={styles.container}>
      <div style={{ ...styles.backdrop, backgroundImage: `url(${background})` }}>
        <h1 style={styles.welcomeText}>Welcome back!</h1>

        {message && (
          <div
            style={{
              ...styles.alert,
              backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: message.type === 'success' ? '#065f46' : '#991b1b',
            }}
          >
            {message.text}
          </div>
        )}

        <div style={styles.loginBox}>
          <form onSubmit={handleLogin} style={styles.form}>
            <input
              type="text"
              name="username"
              placeholder="USERNAME"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="PASSWORD"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              required
            />
            <button type="submit" style={styles.button}>
              Log In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#7b8b6f',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: "60px",
    boxSizing: "border-box"
  },
  backdrop: {
    width: "100%",
    maxWidth: "2000px",
    height: "100%",
    maxHeight: "1000px",
    aspectRatio: "16 / 9",
    borderRadius: "16px",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box",
    position: "relative",
  },
  welcomeText: {
    color: '#F3F0D7',
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '20px',
  },
  loginBox: {
    backgroundColor: '#1e341b',
    padding: '30px',
    borderRadius: '14px',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)',
    width: '320px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  input: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#aab29a',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    padding: '10px',
    borderRadius: '20px',
    backgroundColor: '#c49e16',
    color: 'white',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    transition: '0.3s ease',
  },
  alert: {
    padding: '10px 14px',
    marginBottom: '14px',
    borderRadius: '6px',
    fontSize: '14px',
    width: '320px',
    textAlign: 'center',
  },
};

export default Login;