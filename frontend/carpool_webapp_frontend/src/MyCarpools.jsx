import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function MyCarpools() {
  const [username, setUsername] = useState('');
  const [carpools, setCarpools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Filter states
  const [roleFilter, setRoleFilter] = useState('either');
  const [arrivalDate, setArrivalDate] = useState('');
  const [hidePastCarpools, setHidePastCarpools] = useState(true);

  // Format today's date as YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  // Helper function to format address
  const formatAddress = (address) => {
    if (!address) return "Not specified";
    
    try {
      // If it's a string that looks like JSON, parse it
      const addressObj = typeof address === 'string' && address.includes('{') 
        ? JSON.parse(address) 
        : address;
      
      // Check if it's already an object with the expected properties
      if (typeof addressObj === 'object') {
        const parts = [];
        
        if (addressObj.street) parts.push(addressObj.street);
        if (addressObj.city) parts.push(addressObj.city);
        if (addressObj.state) parts.push(addressObj.state);
        if (addressObj.zip) parts.push(addressObj.zip);
        
        return parts.join(', ');
      }
      
      // If none of the above worked, just return the original
      return address;
    } catch (e) {
      // If parsing fails, return the original string
      return address;
    }
  };

  // Function to fetch user's carpools with filters
  const fetchMyCarpools = async () => {
    setLoading(true);
    setError('');
    
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
      return;
    }

    try {
      // Build the URL with query parameters
      let url = new URL('http://127.0.0.1:5000/api/carpools/my-carpools');
      
      // Add filter parameters
      url.searchParams.append('role', roleFilter);
      if (arrivalDate) url.searchParams.append('arrival_date', arrivalDate);
      url.searchParams.append('hide_past', hidePastCarpools.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch carpools');
      }

      const data = await response.json();
      setCarpools(data.carpools || []);
    } catch (error) {
      console.error('Error fetching carpools:', error);
      setError('Failed to load carpools. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user info and carpools on component mount
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

        if (!response.ok) {
          console.error('Failed to fetch user information');
          Cookies.remove('access_token');
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
        
        // Load initial carpools after user is authenticated
        fetchMyCarpools();
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  // Handle role filter change
  const handleRoleFilterChange = (e) => {
    setRoleFilter(e.target.value);
  };

  // Handle arrival date change
  const handleArrivalDateChange = (e) => {
    setArrivalDate(e.target.value);
  };

  // Handle hide past carpools toggle
  const handleHidePastCarpoolsChange = () => {
    setHidePastCarpools(!hidePastCarpools);
  };

  // Apply filters
  const handleApplyFilters = () => {
    fetchMyCarpools();
  };

  // Handle view carpool listing
  const handleViewListing = (carpoolId) => {
    navigate(`/carpool-listing?carpool_id=${carpoolId}`);
  };

  // Handle leave carpool
  const handleLeaveCarpool = async (carpoolId) => {
    if (!confirm('Are you sure you want to leave this carpool?')) {
      return;
    }

    try {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }

      const response = await fetch('http://127.0.0.1:5000/api/carpool/remove-passenger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          carpool_id: carpoolId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to leave carpool');
      }

      // Refresh the carpool list
      fetchMyCarpools();
      alert('Successfully left the carpool');
    } catch (error) {
      console.error('Error leaving carpool:', error);
      setError('Failed to leave carpool. Please try again.');
    }
  };

  const handleLogout = () => {
    Cookies.remove('access_token');
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleGoCarpoolSearch = () => {
    navigate('/carpool');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
           <h1 className="text-xl font-semibold text-[#2A9D8F]">My Carpools</h1>
           <span className="text-gray-600">Welcome, {username || '...'}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleGoCarpoolSearch}
            className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
          >
            Find Carpools
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
      <div className="flex-grow mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl">
        {error && (
          <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#264653] mb-4">
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Show me listings where I am:
              </label>
              <select
                value={roleFilter}
                onChange={handleRoleFilterChange}
                className="w-full p-2 border rounded bg-white"
              >
                <option value="either">Either driver or passenger</option>
                <option value="driver">The driver</option>
                <option value="passenger">A passenger</option>
              </select>
            </div>
            
            {/* Arrival Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arrives On:
              </label>
              <input
                type="date"
                value={arrivalDate}
                onChange={handleArrivalDateChange}
                min={today}
                className="w-full p-2 border rounded bg-white"
              />
            </div>
            
            {/* Hide Past Carpools Filter */}
            <div className="flex items-center h-full pt-8">
              <input
                type="checkbox"
                id="hidePastCarpools"
                checked={hidePastCarpools}
                onChange={handleHidePastCarpoolsChange}
                className="h-4 w-4 text-[#2A9D8F] focus:ring-[#2A9D8F] border-gray-300 rounded"
              />
              <label htmlFor="hidePastCarpools" className="ml-2 block text-sm text-gray-700">
                Hide Past Carpools
              </label>
            </div>
          </div>
          
          {/* Apply Filters Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-[#E9C46A] text-white rounded-lg hover:bg-[#F4A261]"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Carpools List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-[#264653] mb-4">
            My Carpools
          </h2>
          
          {/* List Container */}
          <div className="border rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-500">Loading carpools...</p>
              </div>
            ) : carpools.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-gray-500">No carpools found with the current filters</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {carpools.map(carpool => (
                  <div 
                    key={carpool.carpool_id} 
                    className={`p-4 ${carpool.user_role === 'driver' ? 'bg-blue-50' : 'bg-green-50'}`}
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg text-[#264653]">
                            {carpool.user_role === 'driver' ? 'You are the driver' : `Driver: ${carpool.driver.full_name || carpool.driver.username}`}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            carpool.user_role === 'driver' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {carpool.capacity.current}/{carpool.capacity.max} passengers
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                          <p className="text-sm text-gray-600 truncate">
                            <span className="font-medium">From:</span> {formatAddress(carpool.route.origin)}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            <span className="font-medium">To:</span> {formatAddress(carpool.route.destination)}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Departure:</span> {carpool.route.leave_earliest || "Not specified"}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Arrival:</span> {carpool.route.arrive_by || "Not specified"}
                          </p>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Vehicle:</span> {carpool.vehicle.full_description || 'Not specified'}
                        </p>
                      </div>
                      
                      <div className="md:ml-4 flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewListing(carpool.carpool_id)}
                          className="w-full px-4 py-2 rounded-lg transition duration-200 bg-[#2A9D8F] text-white hover:bg-[#238577]"
                        >
                          View Listing
                        </button>
                        
                        {carpool.user_role === 'passenger' && (
                          <button
                            onClick={() => handleLeaveCarpool(carpool.carpool_id)}
                            className="w-full px-4 py-2 rounded-lg transition duration-200 bg-red-500 text-white hover:bg-red-600"
                          >
                            Leave Carpool
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyCarpools; 