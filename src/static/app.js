document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: show a confirmation modal with Confirm/Cancel
  function showConfirm(text, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal-text">${text}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel">Cancel</button>
          <button class="modal-btn modal-confirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const remove = () => overlay.remove();
    overlay.querySelector('.modal-cancel').addEventListener('click', remove);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });
    overlay.querySelector('.modal-confirm').addEventListener('click', () => {
      remove();
      onConfirm();
    });
  }

  // Helper: show a toast with optional Undo callback
  function showToast(message, undoCallback) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    if (undoCallback) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', async () => {
        await undoCallback();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.innerHTML = '&times;';
    close.addEventListener('click', () => toast.remove());
    toast.appendChild(close);

    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities", { cache: 'no-store' });
      const activities = await response.json();

      // Clear loading message and activity select options
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants list HTML with delete buttons
        const participantsHtml = details.participants && details.participants.length
          ? `<ul class="participants-list">${details.participants.map(p => `<li class="participant-item"><span class="participant-email">${p}</span> <button class="participant-delete" data-activity="${encodeURIComponent(name)}" data-email="${encodeURIComponent(p)}" aria-label="Remove ${p}">✕</button></li>`).join('')}</ul>`
          : `<p class="no-participants">No participants yet</p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            <h5>Participants</h5>
            ${participantsHtml}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
      // Attach delete handlers after rendering (with confirmation + undo)
      document.querySelectorAll('.participant-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const activityName = decodeURIComponent(btn.dataset.activity);
          const email = decodeURIComponent(btn.dataset.email);
          showConfirm(`Remove ${email} from ${activityName}?`, async () => {
            btn.disabled = true;
            try {
              const res = await fetch(`/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`, { method: 'DELETE', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
              const data = await res.json();
              if (res.ok) {
                // refresh list and wait for DOM update
                await fetchActivities();
                showToast(`${email} removed`, async () => {
                  // Undo: re-signup
                  await fetch(`/activities/${encodeURIComponent(activityName)}/signup?email=${encodeURIComponent(email)}`, { method: 'POST', headers: { 'Cache-Control': 'no-cache' } });
                  await fetchActivities();
                });
              } else {
                showToast(data.detail || 'Failed to remove participant');
              }
            } catch (err) {
              console.error('Error removing participant', err);
              showToast('Failed to remove participant');
            } finally {
              btn.disabled = false;
            }
          });
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: { 'Cache-Control': 'no-cache' }
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Refresh activity list to show new participant and wait for DOM update
        await fetchActivities();
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
