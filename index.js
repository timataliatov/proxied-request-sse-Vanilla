const chatForm = document.getElementById('chat-form');
const chatContainer = document.getElementById('chat-container');
const loadingIndicator = document.getElementById('loading');

function showLoading() {
  loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
  loadingIndicator.classList.add('hidden');
}

function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'flex items-start gap-4';

  const avatarDiv = document.createElement('div');
  avatarDiv.className = `rounded-xl w-10 h-10 mt-2 flex items-center justify-center text-[#282a36] font-medium ${role === 'user' ? 'bg-[#bd93f9]' : 'bg-[#50fa7b]'}`;
  avatarDiv.textContent = role === 'user' ? 'You' : 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'flex-1 bg-[#6272a4] rounded-xl p-4';
  contentDiv.innerHTML = marked.parse(content);

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  Prism.highlightAll();
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const promptInput = document.getElementById('prompt');
  const streamCheckbox = document.getElementById('stream');
  const promptValue = promptInput.value.trim();
  const streamValue = streamCheckbox.checked;

  if (!promptValue) return;

  addMessage('user', promptValue);
  promptInput.value = '';
  showLoading();

  try {
    const response = await fetch('http://localhost:5050/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mode': 'production',
        'provider': 'open-ai'
      },
      body: JSON.stringify({
        stream: streamValue,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant.'
          },
          {
            role: 'user',
            content: promptValue
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'An error occurred');
    }

    if (streamValue) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        console.log('Received chunk:', chunk); // Log the received chunk

        // Split the chunk into lines and process each line
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim() !== '') {
            try {
              const jsonData = JSON.parse(line);
              console.log('Parsed JSON:', jsonData); // Log the parsed JSON

              let content = '';
              if (jsonData.choices && jsonData.choices[0]) {
                content = jsonData.choices[0].delta?.content || jsonData.choices[0].message?.content || '';
              }

              if (content) {
                accumulatedContent += content;
                addMessage('AI', accumulatedContent);
              }
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError, 'Line:', line);
            }
          }
        }
      }
    } else {
      const data = await response.json();
      console.log('Non-streaming response:', data); // Log the entire response

      let content = '';
      if (data.choices && data.choices[0]) {
        content = data.choices[0].message?.content || data.choices[0].text || '';
      }

      if (content) {
        addMessage('AI', content);
      } else {
        throw new Error('Unexpected response format');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('AI', `Error: ${error.message}`);
  } finally {
    hideLoading();
  }
});
