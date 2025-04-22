import { useState, useEffect, useCallback, memo } from 'react';
import { GoogleMap, DirectionsRenderer, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import Cookies from 'js-cookie';

// Define libraries array outside component to avoid recreation
const libraries = ['places'];

// Define map container style outside component
const containerStyle = {
  width: '100%',
  height: '100%'
};

// Modal map container style (larger)
const modalMapContainerStyle = {
  width: '100%',
  height: '70vh'
};

// Map options
const mapOptions = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

function RouteMap({ carpoolId, userRole, isModal = false }) {
  const [directions, setDirections] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapData, setMapData] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    apiKeySource: 'Not set',
    apiLoaded: false,
    routeDataFetched: false,
    directionsRequested: false
  });

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.APP_GOOGLE_MAP_API_KEY || 'AIzaSyC0SI_vabMINqTA9b4mYnjZ069trVujYSo',
    libraries,
  });

  useEffect(() => {
    console.log("Maps loaded state:", mapsLoaded);
    setDebugInfo(prev => ({ ...prev, apiLoaded: mapsLoaded }));
  }, [mapsLoaded]);

  // Fetch route data
  const fetchRouteMapData = useCallback(async () => {
    if (!carpoolId || (!userRole.isDriver && !userRole.isPassenger)) {
      console.log("Not fetching route data: missing ID or role");
      return;
    }

    console.log("Fetching route data for carpool:", carpoolId);
    
    try {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        console.log("No access token found");
        return;
      }

      // Reset error state
      setMapError('');

      const response = await fetch(`http://127.0.0.1:5000/api/carpool/route-map?carpool_id=${carpoolId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch route map data:', response.status);
        setMapError('Failed to load route data from server');
        return;
      }

      const data = await response.json();
      console.log("Route data received:", data);
      setDebugInfo(prev => ({ ...prev, routeDataFetched: true }));
      
      if (data.success && data.route) {
        // Save route data for potential fallback
        setMapData(data.route);
        
        // Check if Google Maps API is available
        if (!window.google || !window.google.maps) {
          console.error('Google Maps API not available');
          setMapError('Google Maps API is not available. This might be due to browser settings.');
          return;
        }
        
        // Check if we have valid coordinates
        if (!data.route.origin || !data.route.destination) {
          console.error('Missing origin or destination coordinates');
          setMapError('Unable to load map: Missing location coordinates');
          return;
        }
        
        try {
          console.log("Creating directions request");
          setDebugInfo(prev => ({ ...prev, directionsRequested: true }));
          
          // Create DirectionsService
          const directionsService = new window.google.maps.DirectionsService();
          
          // Create waypoints from passenger pickup and dropoff locations
          const waypoints = data.route.waypoints && data.route.waypoints.length > 0 ? 
            data.route.waypoints.map(point => ({
              location: new window.google.maps.LatLng(point.lat, point.lng),
              stopover: true
            })) : [];
          
          console.log("Origin:", data.route.origin);
          console.log("Destination:", data.route.destination);
          console.log("Waypoints:", waypoints.length);
          
          // Request directions
          directionsService.route(
            {
              origin: new window.google.maps.LatLng(data.route.origin.lat, data.route.origin.lng),
              destination: new window.google.maps.LatLng(data.route.destination.lat, data.route.destination.lng),
              waypoints: waypoints,
              optimizeWaypoints: true,
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              console.log("Directions response status:", status);
              
              if (status === window.google.maps.DirectionsStatus.OK) {
                console.log("Directions loaded successfully");
                setDirections(result);
                setMapLoaded(true);
              } else {
                console.error(`Directions request failed: ${status}`);
                setMapError(`Directions request failed: ${status}`);
              }
            }
          );
        } catch (error) {
          console.error('Error processing directions:', error);
          setMapError('Error processing route directions');
        }
      }
    } catch (error) {
      console.error('Error fetching route map data:', error);
      setMapError('Error loading map data');
    }
  }, [carpoolId, userRole.isDriver, userRole.isPassenger]);

  // Fetch route data when dependencies change
  useEffect(() => {
    if (mapsLoaded && (userRole.isDriver || userRole.isPassenger)) {
      console.log("Initiating route data fetch");
      fetchRouteMapData();
      
      // Set a timeout to show the map anyway if directions take too long
      const timer = setTimeout(() => {
        if (!mapLoaded) {
          console.log("Directions taking too long, showing basic map");
          setMapLoaded(true);
        }
      }, 5000); // 5 seconds timeout
      
      return () => clearTimeout(timer);
    }
  }, [mapsLoaded, fetchRouteMapData, userRole, mapLoaded]);

  if (!mapsLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <p className="text-gray-500 mb-2">Loading map APIs...</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-4">
        <p className="text-red-500 mb-2">{mapError}</p>
        <p className="text-sm text-gray-500 mb-4">
          This might be due to browser privacy settings or network issues.
        </p>
        <div className="text-xs text-gray-400 text-left w-full max-w-md p-2 bg-gray-200 rounded">
          <p>Debug Info:</p>
          <ul className="list-disc pl-5">
            <li>API Loaded: {debugInfo.apiLoaded ? 'Yes' : 'No'}</li>
            <li>Route Data Fetched: {debugInfo.routeDataFetched ? 'Yes' : 'No'}</li>
            <li>Directions Requested: {debugInfo.directionsRequested ? 'Yes' : 'No'}</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!mapLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <p className="text-gray-500 mb-4">Loading route map...</p>
        <div className="text-xs text-gray-400 text-left w-full max-w-md p-2 bg-gray-200 rounded">
          <p>Debug Info:</p>
          <ul className="list-disc pl-5">
            <li>API Loaded: {debugInfo.apiLoaded ? 'Yes' : 'No'}</li>
            <li>Route Data Fetched: {debugInfo.routeDataFetched ? 'Yes' : 'No'}</li>
            <li>Directions Requested: {debugInfo.directionsRequested ? 'Yes' : 'No'}</li>
          </ul>
        </div>
        
        {/* Show a basic map after 5 seconds if directions are taking too long */}
        {debugInfo.directionsRequested && (
          <div className="mt-4">
            <button 
              onClick={() => setMapLoaded(true)} 
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              Show Basic Map
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={isModal ? modalMapContainerStyle : containerStyle}
      zoom={10}
      options={mapOptions}
      center={directions?.routes[0]?.bounds?.getCenter() || 
              (mapData && mapData.origin) ? 
                { lat: mapData.origin.lat, lng: mapData.origin.lng } : 
                { lat: 37.7749, lng: -122.4194 }} // Default to SF if no data
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: "#2A9D8F",
              strokeWeight: 5,
            }
          }}
        />
      )}
      
      {/* If we have map data but no directions, show markers */}
      {!directions && mapData && (
        <>
          {/* Origin marker */}
          {mapData.origin && (
            <MarkerF
              position={{ lat: mapData.origin.lat, lng: mapData.origin.lng }}
              title="Starting Point"
              label={{ text: "S", color: "white" }}
            />
          )}
          
          {/* Destination marker */}
          {mapData.destination && (
            <MarkerF
              position={{ lat: mapData.destination.lat, lng: mapData.destination.lng }}
              title="Destination"
              label={{ text: "D", color: "white" }}
            />
          )}
          
          {/* Waypoint markers */}
          {mapData.waypoints && mapData.waypoints.map((point, index) => (
            <MarkerF
              key={index}
              position={{ lat: point.lat, lng: point.lng }}
              title={point.label || `Waypoint ${index + 1}`}
              label={{ text: (index + 1).toString(), color: "white" }}
            />
          ))}
        </>
      )}
    </GoogleMap>
  );
}

// Create a modal wrapper component for the RouteMap
export const RouteMapModal = ({ isOpen, onClose, carpoolId, userRole }) => {
  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 9999 }}
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-auto shadow-xl relative">        
        <h3 className="text-xl font-medium mb-4 text-gray-800">Carpool Route Map</h3>
        
        <div className="h-[70vh] border rounded-lg overflow-hidden">
          <RouteMap carpoolId={carpoolId} userRole={userRole} isModal={true} />
        </div>
        
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(RouteMap); 