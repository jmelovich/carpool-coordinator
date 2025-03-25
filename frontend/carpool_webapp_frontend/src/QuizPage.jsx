import { useState } from "react";
import './App.css';

function QuizPage() {
  const [quizAnswers, setQuizAnswers] = useState({
    gender: "",
    age: "",
    ageGroup: [18, 90],
    volumePreference: "",
  });

  // sets the errors for age and submitting
  const [step, setStep] = useState(0);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const handleAgeChange = (e) => {
    const age = parseInt(e.target.value, 10);
    if (!isNaN(age)) {
      if (age < 18 || age > 90) {
        setWarning("User must be over 18 and under 90 to register.");
      } else {
        setWarning("");
        // updates the age state
        setQuizAnswers((prev) => ({ ...prev, age }));
      }
    } else {
      setWarning("");
    }
    setQuizAnswers((prev) => ({ ...prev, age: e.target.value }));
  };

  const handleRangeChange = (e, index) => {
    let value = parseInt(e.target.value, 10);
    const newRange = [...quizAnswers.ageGroup];
    newRange[index] = value;
    if (newRange[0] >= 18 && newRange[1] <= 90 && newRange[0] <= newRange[1]) {
      setQuizAnswers((prev) => ({ ...prev, ageGroup: newRange }));
    }
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const validateForm = () => {
    if (!quizAnswers.gender || !quizAnswers.age || !quizAnswers.volumePreference) {
      setError("All fields must be filled out before submitting.");
      return false;
    }

    if (warning) {
      setError("Please resolve all warnings before submitting.");
      return false;
    }

    // clears error if valid
    setError("");
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("Quiz Answers:", quizAnswers);
      alert("Your preferences have been saved!");
    }
  };

  return (
    // quiz section
    <div className="quiz-container">
      <h2>Let's Get to Know You:</h2>
      <form onSubmit={handleSubmit}>
        {step === 0 && (
          <div>
            <label>1. What is your gender?</label>
            <div>
              {["Male", "Female", "Other"].map((gender) => (
                <div
                  key={gender}
                  className={`choice-bar ${quizAnswers.gender === gender ? "selected" : ""}`}
                  onClick={() => setQuizAnswers((prev) => ({ ...prev, gender }))}
                >
                  {gender}
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <label>2. What is your age?</label>
            <input
              type="number"
              name="age"
              value={quizAnswers.age}
              onChange={handleAgeChange}
              min="18"
              max="90"
              required
              style={{ marginTop: "10px", padding: "8px", borderRadius: "5px", width: "100%" }}
            />
            {warning && <p style={{ color: "red", marginTop: "5px" }}>{warning}</p>}
          </div>
        )}
        {step === 2 && (
          <div>
            <label>3. What age group are you comfortable riding with?</label>
            <div className="range-container">
              <div className="range-labels">
                <span>Min: {quizAnswers.ageGroup[0]}</span>
                <span>Max: {quizAnswers.ageGroup[1]}</span>
              </div>
              <input
                type="range"
                className="range-slider"
                min="18"
                max="90"
                value={quizAnswers.ageGroup[0]}
                onChange={(e) => handleRangeChange(e, 0)}
              />
              <input
                type="range"
                className="range-slider"
                min="18"
                max="90"
                value={quizAnswers.ageGroup[1]}
                onChange={(e) => handleRangeChange(e, 1)}
              />
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <label>4. Volume Preference</label>
            <div>
              {["Talks", "Quiet", "Doesn't Matter"].map((preference) => (
                <div
                  key={preference}
                  className={`choice-bar ${quizAnswers.volumePreference === preference ? "selected" : ""}`}
                  onClick={() => setQuizAnswers((prev) => ({ ...prev, volumePreference: preference }))}
                >
                  {preference}
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
        <div>
          {step > 0 && <button type="button" onClick={prevStep}>Back</button>}
          {step < 3 ? (
            <button type="button" onClick={nextStep}>Next</button>
          ) : (
            <button type="submit">Submit</button>
          )}
        </div>
      </form>
    </div>
  );
}

export default QuizPage;