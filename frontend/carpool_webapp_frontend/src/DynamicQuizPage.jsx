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
  
  const navigate = useNavigate();
  const location = useLocation();

  // Sample quiz data template
  const sampleQuizData = {
    id: "sample_quiz",
    title: "Sample Quiz",
    description: "This is a sample quiz demonstrating various question types",
    questions: [
      {
        id: "q1",
        type: "short_text",
        required: true,
        question: "What is your favoritename?"
      },
      {
        id: "q2",
        type: "long_text",
        required: true,
        question: "Type something very interesting here."
      },
      {
        id: "q3",
        type: "dropdown",
        required: true,
        question: "What is your preferred contact method?",
        options: ["Email", "Phone", "Text", "In-person"]
      },
      {
        id: "q4",
        type: "multiple_choice",
        required: true,
        question: "What is your favorite color?",
        options: ["Red", "Blue", "Green", "Yellow", "Purple"]
      },
      {
        id: "q5",
        type: "checkbox",
        required: false,
        question: "How much of these apply to you?",
        options: ["Convicted Felon", "Certified Freak", "Licensed To Kill", "Hopeless"]
      },
      {
        id: "q6",
        type: "address",
        required: false,
        question: "What is your ideal address?"
      }
    ]
  };

  useEffect(() => {
    // Extract quiz ID from URL parameters
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      setQuizId(id);
      console.log("Quiz ID from URL:", id);
    } else {
      console.log("No quiz ID provided in URL");
    }

    // TODO: Implement quiz data fetching from backend
    // It should send a request to the backend with the quiz ID
    // The backend should then return the quiz data
    // For now though, we will directly load the sample quiz data
    setQuestions(sampleQuizData.questions);
    
    // Initialize answers object with empty values for each question
    const initialAnswers = {};
    sampleQuizData.questions.forEach(question => {
      if (question.type === 'checkbox') {
        initialAnswers[question.id] = [];
      } else {
        initialAnswers[question.id] = '';
      }
    });
    setAnswers(initialAnswers);
    setLoading(false);

    // Fetch user information
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
          // Delete cookie and redirect to login
          Cookies.remove('access_token');
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        navigate('/');
      }
    };

    fetchUserInfo();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Quiz ID:", quizId);
    console.log("Submitted answers:", answers);
    
    // Here you would send the answers to the backend
    // For now just log them to the console
    alert("Quiz submitted successfully!");
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
              {sampleQuizData.title}
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

          <p className="text-gray-600 mb-6">{sampleQuizData.description}</p>

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
        </div>
      </div>
    </div>
  );
}

export default DynamicQuizPage; 