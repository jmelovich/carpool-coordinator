import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Cookies from 'js-cookie';

function CarpoolListingPage() {
  const [username, setUsername] = useState('');
  const [carpoolData, setCarpoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPublicView, setIsPublicView] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const carpoolId = searchParams.get('carpool_id');

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
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        Cookies.remove('access_token');
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  useEffect(() => {
    const fetchCarpoolData = async () => {
      if (!carpoolId) {
        setError('No carpool ID provided');
        setLoading(false);
        return;
      }

      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        
        // First try to get the full listing (as owner)
        const fullResponse = await fetch(`http://127.0.0.1:5000/api/carpool/get-full-listing?carpool_id=${carpoolId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (fullResponse.ok) {
          const data = await fullResponse.json();
          setCarpoolData(data.carpool);
          setIsPublicView(false);
          setLoading(false);
          return;
        }
        
        // If that fails, try to get the public listing
        const publicResponse = await fetch(`http://127.0.0.1:5000/api/carpool/get-public-listing?carpool_id=${carpoolId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (publicResponse.ok) {
          const data = await publicResponse.json();
          setCarpoolData(data.carpool);
          setIsPublicView(true);
          setLoading(false);
          return;
        }
        
        // If both fail, show error
        setError('Failed to load carpool information');
        setLoading(false);
      } catch (error) {
        console.error('Error fetching carpool data:', error);
        setError('An error occurred while loading carpool data');
        setLoading(false);
      }
    };

    fetchCarpoolData();
  }, [carpoolId, navigate]);

  const handleLogout = () => {
    Cookies.remove('access_token');
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleGoBack = () => {
    navigate('/carpool');
  };

  // Function to render JSON data in a readable format
  const formatJSON = (obj) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
           <h1 className="text-xl font-semibold text-[#2A9D8F]">Carpool Details</h1>
           <span className="text-gray-600">Welcome, {username || '...'}</span>
           {isPublicView && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Public View</span>}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleGoBack}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Back
          </button>
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

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600 text-lg">Loading carpool information...</p>
          </div>
        ) : carpoolData ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-[#264653] mb-4">
              Carpool #{carpoolId} Details
            </h2>
            
            <div className="bg-gray-50 p-4 rounded-lg overflow-auto">
              <pre className="text-sm">{formatJSON(carpoolData)}</pre>
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-600 text-lg">No carpool data found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CarpoolListingPage; 