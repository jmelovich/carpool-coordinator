import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const libraries = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const AddressInput = ({ value, onChange, placeholder }) => {
  const [showModal, setShowModal] = useState(false);
  const [address, setAddress] = useState(value || '');
  const [displayAddress, setDisplayAddress] = useState(value || '');
  const [center, setCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default to NYC
  const [marker, setMarker] = useState(null);
  
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.APP_GOOGLE_MAP_API_KEY,
    libraries,
  });

  useEffect(() => {
    setAddress(value || '');
    setDisplayAddress(value || '');
  }, [value]);

  const onPlaceSelected = (place) => {
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      
      setCenter({ lat, lng });
      setMarker({ lat, lng });
      
      // Get the formatted address
      const formattedAddress = place.formatted_address;
      setAddress(formattedAddress);
      setDisplayAddress(formattedAddress);
      
      // Call parent component's onChange
      if (onChange) {
        onChange(formattedAddress);
      }
    }
  };

  const initAutocomplete = () => {
    if (!inputRef.current) return;
    
    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      { types: ['address'] }
    );
    
    autocompleteRef.current = autocomplete;
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      onPlaceSelected(place);
    });
    
    // Fix for autocomplete dropdown positioning
    if (inputRef.current && containerRef.current) {
      // Set styles to force the autocomplete dropdown to stay within the modal
      setTimeout(() => {
        const pacContainers = document.querySelectorAll('.pac-container');
        pacContainers.forEach(container => {
          container.style.zIndex = "10000";
          container.style.position = "absolute";
          container.style.width = `${inputRef.current.offsetWidth}px`;
        });
      }, 300);
    }
  };

  useEffect(() => {
    if (isLoaded && showModal) {
      setTimeout(() => {
        initAutocomplete();
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
    }
  }, [isLoaded, showModal]);

  const closeModal = () => {
    setShowModal(false);
  };

  const confirmAddress = () => {
    setShowModal(false);
    if (onChange) {
      onChange(address);
    }
  };

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    setMarker({ lat, lng });
    
    // Reverse geocode to get address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const formattedAddress = results[0].formatted_address;
        setAddress(formattedAddress);
        if (inputRef.current) {
          inputRef.current.value = formattedAddress;
        }
      }
    });
  };

  // Added to prevent scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
      
      // Add global styles for autocomplete dropdown
      const style = document.createElement('style');
      style.textContent = `
        .pac-container {
          z-index: 10000 !important;
          margin-top: 2px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid #e5e7eb !important;
          background-color: white !important;
        }
        .pac-item {
          padding: 8px 10px !important;
          cursor: pointer !important;
        }
        .pac-item:hover {
          background-color: #f9fafb !important;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.body.style.overflow = '';
        document.head.removeChild(style);
      };
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  return (
    <div className="relative address-input">
      <div 
        className="w-full p-2 border rounded cursor-pointer flex items-center bg-white"
        onClick={() => setShowModal(true)}
      >
        {displayAddress ? (
          <span className="truncate flex-grow">{displayAddress}</span>
        ) : (
          <span className="text-gray-400 flex-grow">{placeholder || 'Enter address'}</span>
        )}
        <svg className="w-4 h-4 ml-2 text-gray-500 flex-shrink-0 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ 
          position: 'fixed',
          backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker background
          zIndex: 9999
        }}>
          <div 
            ref={containerRef}
            className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto mx-auto shadow-xl" 
            style={{ 
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', 
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 10000,
              position: 'relative'
            }}
          >
            <h3 className="text-xl font-medium mb-4 text-gray-800">Select Address</h3>
            
            <div className="mb-6 relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Address
              </label>
              <input
                ref={inputRef}
                type="text"
                placeholder="Start typing an address..."
                className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                defaultValue={address}
              />
              <p className="text-sm text-gray-500 mt-2">
                Type an address or click on the map to select a location
              </p>
            </div>
            
            <div className="mb-6 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={center}
                  zoom={13}
                  onClick={handleMapClick}
                >
                  {marker && <Marker position={marker} />}
                </GoogleMap>
              ) : (
                <div className="h-[300px] bg-gray-200 flex items-center justify-center">
                  <p>{loadError ? 'Error loading map' : 'Loading map...'}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors m-0"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddress}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors m-0"
              >
                Confirm Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressInput; 