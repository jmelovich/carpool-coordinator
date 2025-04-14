import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import AddressInput from './components/AddressInput';

function MainCarpoolPage({ onLogout }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [carpools, setCarpools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [filters, setFilters] = useState({
    maxDistance: 50,
    earliestPickupTime: '',
    latestArrival: '',
    minSeatsAvailable: 1
  });
  
  // Get today's date formatted as YYYY-MM-DD for min attribute of date input
  const today = new Date().toISOString().split('T')[0];
  
  const navigate = useNavigate();

  const fetchCarpools = useCallback(async () => {
    setLoading(true);
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/api/carpools', {
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
  }, [navigate]);

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
        
        // Load carpools after authenticating
        fetchCarpools();
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        Cookies.remove('access_token');
        onLogout(); // Use the passed onLogout prop
        navigate('/');
      }
    };

    fetchUserInfo();
    
    // Set up interval to refresh carpools every 15 seconds
    const intervalId = setInterval(() => {
      fetchCarpools();
    }, 15000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [navigate, onLogout, fetchCarpools]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const handleCreateCarpool = async () => {
    try {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/'); // Redirect to login if no token
        return;
      }

      // First, check for missing user info
      const missingInfoResponse = await fetch('http://127.0.0.1:5000/api/users/me/get-missing-info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!missingInfoResponse.ok) {
        throw new Error('Failed to check user info');
      }

      const missingInfoData = await missingInfoResponse.json();
      
      // Check all required info in order - user_info, driver_info
      if (!missingInfoData.user_info.isComplete) {
        navigate(`/quiz?id=${missingInfoData.user_info.quiz_id}`);
        return;
      }
      
      if (!missingInfoData.driver_info.isComplete) {
        navigate(`/quiz?id=${missingInfoData.driver_info.quiz_id}&creating_carpool=true`);
        return;
      }

      // If all info is complete, proceed with creating the carpool
      const response = await fetch('http://127.0.0.1:5000/api/carpool/reserve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reserve carpool listing ID');
      }

      const data = await response.json();
      const newListingId = data.carpool_id;
      navigate(`/quiz?id=create_carpool&new_listing_id=${newListingId}`);
    } catch (error) {
      console.error('Error creating carpool:', error);
      setError('Failed to create carpool. Please try again.');
    }
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleJoinCarpool = (carpoolId) => {
    // This function will be implemented later to handle joining a carpool
    console.log(`Attempting to join carpool ${carpoolId}`);
    // For now, just show an alert
    alert(`Join functionality will be implemented soon for carpool ${carpoolId}`);
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
      <div className="flex-grow mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl">
        {error && (
          <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Main Container */}
        <div className="flex flex-col gap-4">
          {/* Carpool List and Create Button */}
          <div className="bg-white rounded-lg shadow-lg p-6">
             <h2 className="text-xl font-semibold text-[#264653] mb-4">
              Available Carpools
             </h2>
             
             {/* Create Carpool Button */}
             <div className="mb-6 border-b pb-6">
               <button
                  onClick={handleCreateCarpool}
                  className="w-full px-4 py-3 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577] transition duration-200"
                >
                  Create New Carpool
               </button>
               
               {/* Pickup and Dropoff Location Inputs using the new AddressInput component */}
               <div className="mt-4 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Pickup Location:
                     </label>
                     <AddressInput
                       value={pickupLocation}
                       onChange={setPickupLocation}
                       placeholder="Click to select pickup address "
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Dropoff Location:
                     </label>
                     <AddressInput
                       value={dropoffLocation}
                       onChange={setDropoffLocation}
                       placeholder="Click to select destination address "
                     />
                   </div>
                 </div>
                 
                 {/* Date Selector */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Travel Date
                   </label>
                   <input
                     type="date"
                     value={travelDate}
                     onChange={(e) => setTravelDate(e.target.value)}
                     min={today}
                     className="w-full p-2 border rounded bg-white"
                   />
                 </div>
               </div>
             </div>
             
             {/* Filters Section */}
             <div className="mb-6 border-b pb-6">
               <button
                 onClick={() => setShowFilters(!showFilters)}
                 className="flex items-center justify-between w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
               >
                 <span>Filters</span>
                 <span>{showFilters ? '▲' : '▼'}</span>
               </button>
               
               {showFilters && (
                 <div className="mt-3 p-4 border rounded-lg bg-gray-50">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Max Distance (miles)
                       </label>
                       <input
                         type="range"
                         name="maxDistance"
                         min="1"
                         max="100"
                         value={filters.maxDistance}
                         onChange={handleFilterChange}
                         className="w-full"
                       />
                       <div className="text-sm text-gray-500 text-right">{filters.maxDistance} miles</div>
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Minimum Available Seats
                       </label>
                       <input
                         type="number"
                         name="minSeatsAvailable"
                         min="1"
                         max="10"
                         value={filters.minSeatsAvailable}
                         onChange={handleFilterChange}
                         className="w-full p-2 border rounded bg-white"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Earliest Pickup Time
                       </label>
                       <input
                         type="time"
                         name="earliestPickupTime"
                         value={filters.earliestPickupTime}
                         onChange={handleFilterChange}
                         className="w-full p-2 border rounded bg-white"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Latest Arrival Time
                       </label>
                       <input
                         type="time"
                         name="latestArrival"
                         value={filters.latestArrival}
                         onChange={handleFilterChange}
                         className="w-full p-2 border rounded bg-white"
                       />
                     </div>
                   </div>
                 </div>
               )}
             </div>

            {/* Scrollable List Area - Fixed height container */}
            <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <div className="h-full overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <p className="text-gray-500">Loading carpools...</p>
                  </div>
                ) : carpools.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <p className="text-gray-500">No available carpools found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {carpools.map(carpool => (
                      <div key={carpool.carpool_id} className="p-4 hover:bg-gray-50 transition duration-150">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-[#264653]">
                              {carpool.driver.full_name || carpool.driver.username}
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              <div>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">From:</span> {carpool.route.origin}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">To:</span> {carpool.route.destination}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Departure:</span> {carpool.route.leave_earliest}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Arrival:</span> {carpool.route.arrive_by}
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Vehicle:</span> {carpool.vehicle.full_description || 'Not specified'}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Capacity:</span> {carpool.capacity.current}/{carpool.capacity.max} passengers
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 md:mt-0 md:ml-4">
                            <button
                              onClick={() => handleJoinCarpool(carpool.carpool_id)}
                              className={`w-full md:w-auto px-4 py-2 rounded-lg transition duration-200 ${
                                carpool.capacity.current >= carpool.capacity.max 
                                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                              disabled={carpool.capacity.current >= carpool.capacity.max}
                            >
                              {carpool.capacity.current >= carpool.capacity.max ? 'Full' : 'Attempt To Join'}
                            </button>
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
      </div>
    </div>
  );
}

export default MainCarpoolPage; 