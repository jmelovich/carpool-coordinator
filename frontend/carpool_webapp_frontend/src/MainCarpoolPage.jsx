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
      // Create URL with query parameters for filters
      let url = new URL('http://127.0.0.1:5000/api/carpools');
      
      // Add filter parameters
      if (pickupLocation) url.searchParams.append('pickup_location', pickupLocation);
      if (dropoffLocation) url.searchParams.append('dropoff_location', dropoffLocation);
      if (travelDate) url.searchParams.append('travel_date', travelDate);
      
      // Add other filters
      if (filters.earliestPickupTime) url.searchParams.append('earliest_pickup', filters.earliestPickupTime);
      if (filters.latestArrival) url.searchParams.append('latest_arrival', filters.latestArrival);
      if (filters.minSeatsAvailable) url.searchParams.append('min_seats', filters.minSeatsAvailable);

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
  }, [navigate, pickupLocation, dropoffLocation, travelDate, filters]);

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
    
    // Set up interval to refresh carpools every 60 seconds
    const intervalId = setInterval(() => {
      fetchCarpools();
    }, 60000);
    
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
               
               {/* Search Button */}
               <div className="mt-4">
                 <button
                   onClick={fetchCarpools}
                   className="w-full px-4 py-2 bg-[#E9C46A] text-white rounded-lg hover:bg-[#F4A261] transition duration-200"
                 >
                   Search Carpools
                 </button>
               </div>
             </div>

            {/* Scrollable List Area - Fixed height container */}
            <div className="border rounded-lg overflow-hidden" style={{ height: '400px', position: 'relative' }}>
              <div className="h-full overflow-y-auto" style={{ position: 'absolute', inset: '0', width: '100%' }}>
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
                    {/* Sort carpools to display viable ones first */}
                    {[...carpools].sort((a, b) => {
                      // If a has route_info and is viable but b doesn't or isn't, a comes first
                      if (a.route_info?.is_viable && (!b.route_info || !b.route_info.is_viable)) return -1;
                      // If b has route_info and is viable but a doesn't or isn't, b comes first
                      if (b.route_info?.is_viable && (!a.route_info || !a.route_info.is_viable)) return 1;
                      // Default to keeping original order
                      return 0;
                    }).map(carpool => (
                      <div 
                        key={carpool.carpool_id} 
                        className={`mb-3 mx-2 p-3 rounded-lg shadow-sm border transition duration-150 ${
                          carpool.route_info?.is_viable 
                            ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-lg text-[#264653]">
                                {carpool.driver.full_name || carpool.driver.username}
                              </h3>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {carpool.capacity.current}/{carpool.capacity.max} passengers
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                              <p className="text-sm text-gray-600 truncate">
                                <span className="font-medium">From:</span> {carpool.route.origin}
                              </p>
                              <p className="text-sm text-gray-600 truncate">
                                <span className="font-medium">To:</span> {carpool.route.destination}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Departure:</span> {carpool.route.leave_earliest}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Arrival:</span> {carpool.route.arrive_by}
                              </p>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Vehicle:</span> {carpool.vehicle.full_description || 'Not specified'}
                            </p>
                            
                            {/* Route Information */}
                            {carpool.route_info && (
                              <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Est. Pickup:</span> {carpool.route_info.pickup_time}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Est. Dropoff:</span> {carpool.route_info.dropoff_time}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Distance:</span> {carpool.route_info.total_distance} mi 
                                      <span className="text-xs text-gray-500 ml-1">
                                        (original: {carpool.route_info.original_distance} mi)
                                      </span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Duration:</span> {carpool.route_info.total_duration} min 
                                      <span className="text-xs text-gray-500 ml-1">
                                        (original: {carpool.route_info.original_duration} min)
                                      </span>
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Detour:</span> +{carpool.route_info.distance_detour} mi / +{carpool.route_info.duration_detour} min
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Total Stops:</span> {carpool.route_info.total_stops || (carpool.capacity.current + 2)}
                                    </p>
                                  </div>
                                  
                                  {/* Viability status */}
                                  <div>
                                    {carpool.route_info.is_viable ? (
                                      <p className="text-sm text-green-600 font-medium">
                                        ✓ This carpool is a good match for you
                                      </p>
                                    ) : (
                                      <div>
                                        <p className="text-sm text-red-600 font-medium">
                                          ✗ This carpool might not work for you
                                        </p>
                                        {carpool.route_info.viability_issues && carpool.route_info.viability_issues.length > 0 && (
                                          <div className="mt-1">
                                            <ul className="text-xs text-red-500 list-disc ml-4">
                                              {carpool.route_info.viability_issues.map((issue, index) => (
                                                <li key={index}>{issue}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="md:ml-4 flex-shrink-0">
                            <button
                              onClick={() => handleJoinCarpool(carpool.carpool_id)}
                              className={`w-full px-4 py-2 rounded-lg transition duration-200 ${
                                carpool.capacity.current >= carpool.capacity.max || (carpool.route_info && !carpool.route_info.is_viable)
                                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                              disabled={carpool.capacity.current >= carpool.capacity.max || (carpool.route_info && !carpool.route_info.is_viable)}
                            >
                              {carpool.capacity.current >= carpool.capacity.max 
                                ? 'Full' 
                                : (carpool.route_info && !carpool.route_info.is_viable) 
                                  ? 'Not Compatible' 
                                  : 'Attempt To Join'}
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