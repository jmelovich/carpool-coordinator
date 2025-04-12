import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Cookies from 'js-cookie';

function DynamicQuizPage() {
  const [username, setUsername] = useState('');
  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [returnAddress, setReturnAddress] = useState('/home');
  const [queryParams, setQueryParams] = useState({});
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract all URL parameters
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    
    // Create an object to store all query parameters
    const allParams = {};
    params.forEach((value, key) => {
      if (key !== 'id') {
        allParams[key] = value;
      }
    });
    
    // Store additional query parameters
    setQueryParams(allParams);
    console.log("Additional URL parameters:", allParams);
    
    if (id) {
      setQuizId(id);
      console.log("Quiz ID from URL:", id);
    } else {
      console.log("No quiz ID provided in URL");
      setError("No quiz ID provided in URL");
      setLoading(false);
      return;
    }

    // Check if access token exists
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      console.log("No access token found, redirecting to login");
      navigate('/');
      return;
    }
    console.log("Access token found:", accessToken.substring(0, 10) + "...");

    // Fetch user information
    const fetchUserInfo = async () => {
      try {
        console.log("Fetching user information...");
        const response = await fetch('http://127.0.0.1:5000/api/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.error('Failed to fetch user information:', response.status, response.statusText);
          // Delete cookie and redirect to login
          Cookies.remove('access_token');
          navigate('/');
          return;
        }

        const data = await response.json();
        console.log("User info fetched successfully:", data);
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        // Don't navigate here, just set the error
      }
    };

    // Fetch quiz data from backend
    const fetchQuizData = async () => {
      try {
        console.log("Fetching quiz data for ID:", id);
        const response = await fetch(`http://127.0.0.1:5000/api/quiz/get?quiz_id=${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.error('Failed to fetch quiz data:', response.status, response.statusText);
          setError('Failed to load quiz data');
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log("Quiz data from API:", data);
        
        try {
          // Parse the JSON string from the response
          const quizData = JSON.parse(data.json);
          console.log("Parsed quiz data:", quizData);
          
          // Set quiz metadata
          setQuizTitle(quizData.title);
          setQuizDescription(quizData.description);
          setReturnAddress(data.return_address);
          
          // Set questions
          setQuestions(quizData.questions);
          
          // Initialize answers object with values from existing_answers or empty values for each question
          const initialAnswers = {};
          quizData.questions.forEach(question => {
            // Check if there's an existing answer for this question's universal_id
            const existingAnswer = data.existing_answers[question.universal_id];
            
            if (question.type === 'checkbox') {
              initialAnswers[question.id] = existingAnswer || [];
            } else {
              initialAnswers[question.id] = existingAnswer || '';
            }
          });
          
          console.log("Initial answers with existing data:", initialAnswers);
          setAnswers(initialAnswers);
          setLoading(false);
        } catch (parseError) {
          console.error('Error parsing quiz JSON:', parseError);
          setError('Failed to parse quiz data');
          setLoading(false);
        }   
      } catch (error) {
        console.error('Error fetching quiz data:', error);
        setError('Failed to load quiz data');
        setLoading(false);
      }
    };

    // Run both fetch operations
    fetchUserInfo();
    fetchQuizData();
  }, [navigate, location]);

  const handleInputChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleCheckboxChange = (questionId, option) => {
    setAnswers(prev => {
      const currentSelections = prev[questionId] || [];
      if (currentSelections.includes(option)) {
        return {
          ...prev,
          [questionId]: currentSelections.filter(item => item !== option)
        };
      } else {
        return {
          ...prev,
          [questionId]: [...currentSelections, option]
        };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Quiz ID:", quizId);
    console.log("Submitted answers:", answers);
    console.log("Context parameters:", queryParams);
    
    // Create a map of universal_id to answers
    const universalIdAnswers = {};
    
    // Create a mapping from universal_id to question_id
    const questionIdMap = {};
    
    questions.forEach(question => {
      universalIdAnswers[question.universal_id] = answers[question.id];
      questionIdMap[question.universal_id] = question.id;
    });
    
    console.log("Universal ID answers map:", universalIdAnswers);
    console.log("Question ID map:", questionIdMap);
    
    try {
      const accessToken = Cookies.get('access_token');
      const response = await fetch('http://127.0.0.1:5000/api/quiz/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quiz_id: quizId,
          answers: universalIdAnswers,
          question_ids: questionIdMap,
          raw_answers: answers,  // Also include the original answers keyed by question_id directly
          context: queryParams
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save quiz: ${response.status}`);
      }
      
      alert("Quiz submitted successfully!");
      // Navigate to the return address
      navigate(returnAddress);
    } catch (error) {
      console.error('Error saving quiz answers:', error);
      setError('Failed to save quiz answers. Please try again.');
    }
  };

  // Render different question types
  const renderQuestion = (question) => {
    switch(question.type) {
      case 'short_text':
        return (
          <input
            type="text"
            id={question.id}
            value={answers[question.id] || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            required={question.required}
          />
        );
      
      case 'long_text':
        return (
          <textarea
            id={question.id}
            value={answers[question.id] || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded h-32"
            required={question.required}
          />
        );
      
      case 'dropdown':
        return (
          <select
            id={question.id}
            value={answers[question.id] || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            required={question.required}
          >
            <option value="">Select an option</option>
            {question.options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="radio"
                  id={`${question.id}-${index}`}
                  name={question.id}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={() => handleInputChange(question.id, option)}
                  required={question.required}
                  className="mr-2"
                />
                <label htmlFor={`${question.id}-${index}`}>{option}</label>
              </div>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="checkbox"
                  id={`${question.id}-${index}`}
                  value={option}
                  checked={(answers[question.id] || []).includes(option)}
                  onChange={() => handleCheckboxChange(question.id, option)}
                  className="mr-2"
                />
                <label htmlFor={`${question.id}-${index}`}>{option}</label>
              </div>
            ))}
          </div>
        );
      
      case 'date':
        // Convert stored MM-DD-YYYY to YYYY-MM-DD for the date input
        let dateInputValue = '';
        if (answers[question.id]) {
          try {
            const [month, day, year] = answers[question.id].split('-');
            if (month && day && year) {
              dateInputValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          } catch (error) {
            console.error('Error parsing date value:', error);
          }
        }
        
        return (
          <input
            type="date"
            id={question.id}
            value={dateInputValue}
            onChange={(e) => {
              // Convert YYYY-MM-DD format to MM-DD-YYYY format
              const dateValue = e.target.value;
              if (dateValue) {
                const [year, month, day] = dateValue.split('-');
                const formattedDate = `${month}-${day}-${year}`;
                handleInputChange(question.id, formattedDate);
              } else {
                handleInputChange(question.id, '');
              }
            }}
            className="w-full p-2 border border-gray-300 rounded"
            required={question.required}
          />
        );
      
      case 'time':
        return (
          <input
            type="time"
            id={question.id}
            value={answers[question.id] || ''}
            onChange={(e) => {
              // Time input already provides HH:MM format
              handleInputChange(question.id, e.target.value);
            }}
            className="w-full p-2 border border-gray-300 rounded"
            required={question.required}
          />
        );
      
      case 'date_time':
        // Parse existing value to populate date and time fields
        const existingDateTime = answers[question.id] || '';
        let dateValue = '';
        let timeValue = '';
        
        if (existingDateTime) {
          const [datePart, timePart] = existingDateTime.split(';');
          if (datePart) {
            try {
              // Convert MM-DD-YYYY back to YYYY-MM-DD for the date input
              const [month, day, year] = datePart.split('-');
              if (month && day && year) {
                dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } catch (error) {
              console.error('Error parsing date part:', error);
            }
          }
          timeValue = timePart || '';
        }
        
        return (
          <div className="space-y-2">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  id={`${question.id}-date`}
                  value={dateValue}
                  onChange={(e) => {
                    const newDateValue = e.target.value;
                    let newCombinedValue = '';
                    
                    if (newDateValue) {
                      // Convert YYYY-MM-DD to MM-DD-YYYY
                      const [year, month, day] = newDateValue.split('-');
                      const formattedDate = `${month}-${day}-${year}`;
                      newCombinedValue = timeValue ? `${formattedDate};${timeValue}` : formattedDate;
                    } else if (timeValue) {
                      newCombinedValue = `;${timeValue}`;
                    }
                    
                    handleInputChange(question.id, newCombinedValue);
                  }}
                  className="w-full p-2 border border-gray-300 rounded"
                  required={question.required}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Time</label>
                <input
                  type="time"
                  id={`${question.id}-time`}
                  value={timeValue}
                  onChange={(e) => {
                    const newTimeValue = e.target.value;
                    let newCombinedValue = '';
                    
                    // Get the date part from the stored value in MM-DD-YYYY format
                    const datePart = existingDateTime.split(';')[0] || '';
                    
                    if (datePart && newTimeValue) {
                      newCombinedValue = `${datePart};${newTimeValue}`;
                    } else if (datePart) {
                      newCombinedValue = datePart;
                    } else if (newTimeValue) {
                      newCombinedValue = `;${newTimeValue}`;
                    }
                    
                    handleInputChange(question.id, newCombinedValue);
                  }}
                  className="w-full p-2 border border-gray-300 rounded"
                  required={question.required}
                />
              </div>
            </div>
          </div>
        );
      
      case 'address':
        return (
          <div className="space-y-2">
            <input
              type="text"
              id={`${question.id}-street`}
              placeholder="Street Address"
              value={(answers[question.id] || {}).street || ''}
              onChange={(e) => handleInputChange(question.id, {...(answers[question.id] || {}), street: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded"
              required={question.required}
            />
            <div className="flex gap-2">
              <input
                type="text"
                id={`${question.id}-city`}
                placeholder="City"
                value={(answers[question.id] || {}).city || ''}
                onChange={(e) => handleInputChange(question.id, {...(answers[question.id] || {}), city: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
                required={question.required}
              />
              <input
                type="text"
                id={`${question.id}-state`}
                placeholder="State"
                value={(answers[question.id] || {}).state || ''}
                onChange={(e) => handleInputChange(question.id, {...(answers[question.id] || {}), state: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
                required={question.required}
              />
            </div>
            <input
              type="text"
              id={`${question.id}-zip`}
              placeholder="ZIP Code"
              value={(answers[question.id] || {}).zip || ''}
              onChange={(e) => handleInputChange(question.id, {...(answers[question.id] || {}), zip: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded"
              required={question.required}
            />
          </div>
        );
      
      case 'integer':
        return (
          <input
            type="number"
            id={question.id}
            value={answers[question.id] || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            required={question.required}
            step="1"
            onInput={(e) => {
              // Force integer values by removing decimals
              if (e.target.value.includes('.')) {
                e.target.value = parseInt(e.target.value) || '';
                handleInputChange(question.id, e.target.value);
              }
            }}
          />
        );
      
      default:
        return <p>Unsupported question type: {question.type}</p>;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#2A9D8F]">
              {quizTitle || "Loading Quiz..."}
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Welcome, {username || 'User'}</span>
              <button
                onClick={() => navigate('/home')}
                className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                Home
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
              {error}
            </div>
          )}

          <p className="text-gray-600 mb-6">{quizDescription || "Loading description..."}</p>

          {questions.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="bg-[#E9F5F5] p-4 rounded-lg">
                  <label className="block text-lg font-medium text-[#2A9D8F] mb-2">
                    {index + 1}. {question.question} {question.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderQuestion(question)}
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577] font-medium"
                >
                  Submit
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No questions found for this quiz.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DynamicQuizPage; 