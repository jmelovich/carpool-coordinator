import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function MainCarpoolPage({ onLogout }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/'); // Redirect to login if no token
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

        if (!response.ok) {
          console.error('Failed to fetch user information');
          Cookies.remove('access_token');
          onLogout(); // Use the passed onLogout prop
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        Cookies.remove('access_token');
        onLogout(); // Use the passed onLogout prop
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate, onLogout]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleCreateCarpool = () => {
    navigate('/create-carpool');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
           <h1 className="text-xl font-semibold text-[#2A9D8F]">Carpool</h1>
           <span className="text-gray-600">Welcome, {username || '...'}</span>
        </div>
        <div className="flex items-center space-x-4">
         <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Home
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {error && (
          <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Placeholder for Dynamic Questions/Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#264653] mb-4">
            Find Your Ride
          </h2>
          <p className="text-gray-600">
            {/* This section will dynamically ask questions to find suitable carpools. */}
            {/* Example: Input fields for destination, time, preferences, etc. */}
            {/* For now, it's a placeholder. */}
            (Questionnaire area - to be implemented)
          </p>
        </div>

        {/* Placeholder for Carpool List and Create Button */}
        <div className="bg-white rounded-lg shadow-lg p-6">
           {/* Fixed Create Carpool Button */}
           <div className="mb-4 border-b pb-4">
             <button
                onClick={handleCreateCarpool}
                className="w-full px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                Create New Carpool
             </button>
            </div>

           <h2 className="text-xl font-semibold text-[#264653] mb-4">
            Available Carpools
          </h2>
          {/* Scrollable List Area */}
          <div className="overflow-y-auto h-96"> {/* Example fixed height + scroll */}
            <p className="text-gray-600">
              {/* This list will be populated dynamically based on the answers above. */}
              {/* It will show available carpools and update periodically. */}
              {/* For now, it's a placeholder. */}
              (Scrollable carpool list area - to be implemented)
            </p>
             {/* Example List Item Structure (to be replaced with dynamic data) */}
             {/*
             <div className="border p-4 my-2 rounded-md bg-gray-50">
                <p><strong>Destination:</strong> Example Location</p>
                <p><strong>Time:</strong> 8:00 AM</p>
                <p><strong>Driver:</strong> John Doe</p>
             </div>
             */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainCarpoolPage; 