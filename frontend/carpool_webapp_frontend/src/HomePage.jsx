import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function HomePage({ onLogout }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch('http://127.0.0.1:5000/api/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
       // console.log("Access Token: ", accessToken);
        if (!response.ok) {
          console.error('Failed to fetch user information');
          // delete cookie
          Cookies.remove('access_token');
          // redirect to login
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        // If there's an error with the token, redirect to login
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#2A9D8F]">
              Welcome, {username || 'Loading...'}!
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#E9F5F5] p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-[#2A9D8F] mb-4">
                Create a Carpool
              </h2>
              <p className="text-gray-600 mb-4">
                Start a new carpool and invite others to join your ride.
              </p>
              <button
                onClick={() => navigate('/create-carpool')}
                className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                Create Carpool
              </button>
            </div>

            <div className="bg-[#E9F5F5] p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-[#2A9D8F] mb-4">
                My Carpools
              </h2>
              <p className="text-gray-600 mb-4">
                View and manage your existing carpools.
              </p>
              <button
                onClick={() => navigate('/my-carpools')}
                className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                View Carpools
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage; 