import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import './styles/styles.css';
import background from './assets/green_splash_2.png';

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
    <div className="mt-6 p-6 bg-white shadow-lg rounded-lg border w-80">
      <div style={{backgroundImage: `url(${background})`, 
      backgroundRepeat: "no-repeat", 
      backgroundSize: "cover",
      width:"89%",
      margin:"0 auto", 
      borderRadius:"20px",
      height: "55em"}}>
        <h2 className="text-lg font-semibold mb-2" style={{color: '#F3F0D7', paddingTop: "186px"}}>Welcome back!</h2>

        {message && (
          <div className={`alert ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} p-4 mb-4`}>
            {message.text}
          </div>
        )}
        <div style={{backgroundColor: '#233d14', borderRadius:"20px", margin: "1em 700px"}}>
          <form onSubmit={handleLogin}>
            <label className="largeLabel" style={{marginTop: "2em"}} htmlFor="username">
              <input
                className="inputBoxLoginRegister"
                type="text"
                name="username"
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </label>
            <label className="largeLabel" style={{marginTop: "10px"}} htmlFor="password">
              <input
                className="inputBoxLoginRegister"
                type="password"
                name="password"
                id="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>
            <button
              type="submit"
              className="buttonLoginRegister w-full p-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
              style={{margin: "8px auto", width: "8em"}}
            >
              Log In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
