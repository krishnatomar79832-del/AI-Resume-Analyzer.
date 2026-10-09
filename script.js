// 👇 APNI API KEY YAHAN DALEIN 👇
const GEMINI_API_KEY = "AQ.Ab8RN6JQ-XV29qK8WF3LVCKkRyyBb5NL3LI-TugkKjpPL8bJNw"; 

// UI Elements
const btn = document.querySelector('#analyzeBtn');
const loadingUI = document.querySelector('#loading');
const errorUI = document.querySelector('#errorBox');
const resultsUI = document.querySelector('#resultsBox');

// File Upload Elements
const fileInput = document.getElementById('resumeFile');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('fileName');
const resumeTextArea = document.getElementById('resumeText');

// --- 1. FILE UPLOAD LOGIC ---
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.innerText = file.name;
    fileNameDisplay.style.color = "#4ADE80";

    if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (event) => {
            resumeTextArea.value = event.target.result;
        };
        reader.readAsText(file);
    } else {
        alert("B.Tech Project Note: Direct PDF/DOCX extraction frontend se possible nahi hai. Abhi ke liye file select ho gayi hai, par AI analysis ke liye kripya apna text niche box mein paste karein.");
    }
});

// --- 2. AI ANALYSIS LOGIC ---
btn.addEventListener('click', async (e) => {
    e.preventDefault();

    const resume = resumeTextArea.value.trim();
    const jd = document.querySelector('#jobDescription').value.trim();

    // Validation
    if (!resume) return showError("Please upload a text file or paste your resume text first!");
    if (GEMINI_API_KEY === "YOUR_API_KEY_HERE") return showError("Dev Error: Put your API key in script.js on Line 2");

    // Reset UI state
    errorUI.classList.add('hidden');
    resultsUI.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = "Processing...";
    loadingUI.classList.remove('hidden');

    const sysPrompt = `
        Act as an expert ATS and tech recruiter. Analyze the following resume.
        Target Job Description (if any): ${jd || 'None provided. Give general advice.'}
        
        Return ONLY a JSON object with this exact structure (no markdown, no formatting):
        {
            "score": 85,
            "strengths": ["HTML5/CSS3", "JavaScript (ES6)"],
            "weaknesses": ["Lack of testing", "No cloud experience mentioned"],
            "recommendedJobs": ["Frontend Developer", "Web Developer"],
            "missingSkills": ["React.js", "Docker"]
        }

        Resume to analyze:
        ${resume}
    `;

    try {
        console.log("Sending request to Gemini API..."); 
        
        // Using gemini-3.8-flash as per previous requirement to avoid 404 error
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: sysPrompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        let rawText = data.candidates[0].content.parts[0].text;

        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(rawText);
        
        console.log("Parsed result:", parsedData); 

        // Update DOM elements
        document.querySelector('#score').innerText = parsedData.score;
        renderList('#strengths', parsedData.strengths);
        renderList('#weaknesses', parsedData.weaknesses);
        renderTags('#recommendedJobs', parsedData.recommendedJobs);
        renderTags('#missingSkills', parsedData.missingSkills);

        resultsUI.classList.remove('hidden');

    } catch (err) {
        console.error("Analysis failed:", err);
        showError("Failed to analyze resume. Check your API key or network connection.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Run AI Analysis";
        loadingUI.classList.add('hidden');
    }
});

/* --- Utility Functions --- */
const showError = (msg) => {
    errorUI.innerText = msg;
    errorUI.classList.remove('hidden');
};

const renderList = (selector, items = []) => {
    document.querySelector(selector).innerHTML = items.map(item => `<li>${item}</li>`).join('');
};

const renderTags = (selector, tags = []) => {
    document.querySelector(selector).innerHTML = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
};