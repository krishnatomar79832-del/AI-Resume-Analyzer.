const btn=document.querySelector('#analyzeBtn');
const loadingUI=document.querySelector('#loading');
const errorUI=document.querySelector('#errorBox');
const resultsUI=document.querySelector('#resultsBox');
const fileInput=document.getElementById('resumeFile');
const uploadBtn=document.getElementById('uploadBtn');
const fileNameDisplay=document.getElementById('fileName');
const resumeTextArea=document.getElementById('resumeText');

uploadBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{
 const file=e.target.files[0]; if(!file)return;
 if(file.size>8*1024*1024){showError('File is larger than 8 MB.');fileInput.value='';return;}
 fileNameDisplay.innerText=file.name;
 fileNameDisplay.style.color='#4ADE80';
 if(file.type==='text/plain'){
  const reader=new FileReader(); reader.onload=ev=>resumeTextArea.value=ev.target.result; reader.readAsText(file);
 }
});

btn.addEventListener('click',async e=>{
 e.preventDefault();
 const file=fileInput.files[0]; const resume=resumeTextArea.value.trim();
 if(!file && !resume)return showError('Please upload your resume or paste the resume text first.');
 errorUI.classList.add('hidden'); resultsUI.classList.add('hidden'); btn.disabled=true; btn.innerText='Processing...'; loadingUI.classList.remove('hidden');
 const form=new FormData();
 if(file)form.append('resumeFile',file);
 if(resume)form.append('resumeText',resume);
 form.append('jobDescription',document.querySelector('#jobDescription').value.trim());
 const target=document.querySelector('.text-input'); form.append('targetRole',target.value.trim());
 try{
  const res=await fetch('/api/analyze',{method:'POST',body:form});
  const data=await res.json(); if(!res.ok)throw new Error(data.error||'Analysis failed');
  document.querySelector('#score').innerText=data.score;
  renderList('#strengths',data.strengths); renderList('#weaknesses',data.weaknesses);
  renderTags('#recommendedJobs',data.recommendedJobs); renderTags('#missingSkills',data.missingSkills);
  resultsUI.classList.remove('hidden');
 }catch(err){showError(err.message||'Failed to analyze resume.');}
 finally{btn.disabled=false;btn.innerText='Run AI Analysis';loadingUI.classList.add('hidden');}
});
const showError=msg=>{errorUI.innerText=msg;errorUI.classList.remove('hidden');};
const renderList=(selector,items=[])=>document.querySelector(selector).innerHTML=items.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
const renderTags=(selector,tags=[])=>document.querySelector(selector).innerHTML=tags.map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join('');
const escapeHtml=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
