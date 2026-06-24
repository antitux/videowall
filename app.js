/*
* Copyright (C) 2026 Antitux Networks LLC <me@antitux.dev>
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published
* by the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://gnu.org>.
*/

// Configuration management
const CONFIG_KEY = 'twitch_tracker_config';

class TTVVideoWall {
  constructor() {
    this.config = null;
    this.currentStreams = new Set();
    this.countdown = 60;
    this.countdownInterval = null;
    this.hideHeader = this.getUrlParam('hide_header');
    this.autoHideTriggered = false;
    this.headerVisible = true;
    this.hideTimeout = null;
    
    this.init();
  }

  getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(param);
    
    // For boolean parameters
    if (param === 'hide_header') {
      return ['true', '1', 'yes'].includes(value?.toLowerCase());
    }
    
    return value;
  }

  init() {
    // Hide modal initially
    const modal = document.getElementById('config-modal');
    modal.style.display = 'none';
    
    // Check for URL parameters first
    const urlConfig = this.getConfigFromUrl();
    
    if (urlConfig) {
      // URL params take precedence
      this.config = urlConfig;
      
      // Optionally save to localStorage if 'save' param is present
      if (this.getUrlParam('save') === 'true') {
        this.saveConfig(urlConfig);
      }
    } else {
      // Fall back to localStorage
      this.loadConfig();
    }
    
    this.setupEventListeners();
    
    if (this.config) {
      this.showApp();
      this.startTracking();
    } else {
      this.showConfigModal();
    }
  }

  getConfigFromUrl() {
    const clientId = this.getUrlParam('client_id');
    const accessToken = this.getUrlParam('access_token');
    const userId = this.getUrlParam('user_id');
    const parentDomain = this.getUrlParam('parent_domain');

    // All required params must be present
    if (clientId && accessToken && userId && parentDomain) {
      return {
        clientId: clientId.trim(),
        accessToken: accessToken.trim(),
        userId: userId.trim(),
        parentDomain: parentDomain.trim()
      };
    }

    return null;
  }

  loadConfig() {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      try {
        this.config = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }

  saveConfig(config) {
    this.config = config;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  setupEventListeners() {
    const form = document.getElementById('config-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleConfigSubmit();
    });

    const reconfigBtn = document.getElementById('reconfig-btn');
    reconfigBtn.addEventListener('click', () => {
      this.showConfigModal();
    });

    window.addEventListener('resize', () => {
      this.updateGridLayout();
    });
  }

  handleConfigSubmit() {
    const config = {
      clientId: document.getElementById('client-id').value.trim(),
      accessToken: document.getElementById('access-token').value.trim(),
      userId: document.getElementById('user-id').value.trim(),
      parentDomain: document.getElementById('parent-domain').value.trim()
    };

    this.saveConfig(config);
    this.hideConfigModal();
    this.showApp();
    this.startTracking();
  }

showConfigModal() {
  const modal = document.getElementById('config-modal');
  modal.style.display = 'flex';
  
  if (this.config) {
    document.getElementById('client-id').value = this.config.clientId;
    document.getElementById('access-token').value = this.config.accessToken;
    document.getElementById('user-id').value = this.config.userId;
    document.getElementById('parent-domain').value = 
      this.config.parentDomain;
    
    // Allow closing by clicking outside if config exists
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.hideConfigModal();
        modal.onclick = null; // Remove the handler
      }
    };
  } else {
    // Don't allow closing if no config exists
    modal.onclick = null;
  }
}

hideConfigModal() {
  const modal = document.getElementById('config-modal');
  modal.style.display = 'none';
  modal.onclick = null; // Clean up the handler
}

  showApp() {
    document.getElementById('app').style.display = 'block';
    
    if (this.hideHeader) {
      document.getElementById('header').classList.add('hidden');
      document.getElementById('streams-container').classList.add('fullscreen');
      document.getElementById('no-streams').classList.add('fullscreen');
    }
  }

  async getFollowedChannels() {
    const url = 'https://api.twitch.tv/helix/channels/followed';
    const headers = {
      'Client-ID': this.config.clientId,
      'Authorization': `Bearer ${this.config.accessToken}`
    };
    
    let allFollows = [];
    let cursor = null;

    try {
      do {
        const params = new URLSearchParams({
          user_id: this.config.userId,
          first: '100'
        });
        
        if (cursor) {
          params.append('after', cursor);
        }

        const response = await fetch(`${url}?${params}`, { headers });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        allFollows = allFollows.concat(data.data);
        cursor = data.pagination?.cursor;
      } while (cursor);

      return allFollows;
    } catch (error) {
      console.error('Error fetching followed channels:', error);
      return [];
    }
  }

  async getLiveStreams(userIds) {
    const url = 'https://api.twitch.tv/helix/streams';
    const headers = {
      'Client-ID': this.config.clientId,
      'Authorization': `Bearer ${this.config.accessToken}`
    };

    let allStreams = [];

    try {
      for (let i = 0; i < userIds.length; i += 100) {
        const batch = userIds.slice(i, i + 100);
        const params = new URLSearchParams();
        batch.forEach(id => params.append('user_id', id));

        const response = await fetch(`${url}?${params}`, { headers });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        allStreams = allStreams.concat(data.data);
      }

      return allStreams;
    } catch (error) {
      console.error('Error fetching live streams:', error);
      return [];
    }
  }

  async checkStreams() {
    if (!this.hideHeader) {
      const statusEl = document.getElementById('status');
      statusEl.className = 'status checking';
      statusEl.innerHTML = '<span class="spinner"></span>Checking...';
    }

    try {
      const follows = await this.getFollowedChannels();
      const broadcasterIds = follows.map(f => f.broadcaster_id);
      const liveStreams = await this.getLiveStreams(broadcasterIds);

      liveStreams.sort((a, b) => b.viewer_count - a.viewer_count);
      const usernames = liveStreams.map(s => s.user_login);

      const newStreams = new Set(usernames);
      const streamsChanged =
        this.currentStreams.size !== newStreams.size ||
        [...this.currentStreams].some(s => !newStreams.has(s)) ||
        [...newStreams].some(s => !this.currentStreams.has(s));

      if (streamsChanged) {
        this.currentStreams = newStreams;
        this.renderStreams(usernames);
      }

      if (!this.hideHeader) {
        document.getElementById('status').className = 'status';
      }
      
      this.resetCountdown();
      
      // Trigger auto-hide after first successful check
      if (!this.autoHideTriggered && !this.hideHeader) {
        this.autoHideTriggered = true;
        setTimeout(() => {
          this.autoHideHeader();
        }, 5000);
      }
    } catch (error) {
      console.error('Error checking streams:', error);
      
      if (!this.hideHeader) {
        document.getElementById('status').className = 'status';
      }
      
      this.resetCountdown();
    }
  }

  renderStreams(usernames) {
    const container = document.getElementById('streams-container');
    const noStreams = document.getElementById('no-streams');
    const title = document.getElementById('title');

    if (usernames.length === 0) {
      container.style.display = 'none';
      noStreams.style.display = 'flex';
      title.textContent = 'TTV VideoWall: No Streams Live';
      document.title = 'TTV VideoWall - No Streams Live';
    } else {
      container.style.display = 'grid';
      noStreams.style.display = 'none';
      
      const streamText = usernames.length === 1 ? 'Stream' : 'Streams';
      title.textContent = 
        `TTV VideoWall: 🔴 ${usernames.length} ${streamText} Live`;
      document.title = 
        `TTV VideoWall - ${usernames.length} ${streamText} Live`;

      // Build parent parameter - use current hostname as primary
      const currentHost = window.location.hostname;
      const configuredParent = this.config.parentDomain;
      const isValidParentHost = (host) =>
        typeof host === 'string' &&
        /^[a-zA-Z0-9.-]+$/.test(host) &&
        !host.startsWith('.') &&
        !host.endsWith('.') &&
        host.length <= 253;
      
      // Build parent params - include both current host and configured domain
      const parentValues = [currentHost];
      if (
        configuredParent &&
        configuredParent !== currentHost &&
        isValidParentHost(configuredParent)
      ) {
        parentValues.push(configuredParent);
      }
      
      // Also add localhost variants if on local network
      if (currentHost.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        parentValues.push('localhost');
      }

      const parentParams = parentValues
        .map((p) => `parent=${encodeURIComponent(p)}`)
        .join('&');

      container.innerHTML = '';
      usernames.forEach(username => {
        const streamDiv = document.createElement('div');
        streamDiv.className = 'stream';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'stream-label';
        labelDiv.textContent = username;

        const iframe = document.createElement('iframe');
        iframe.setAttribute(
          'src',
          `https://player.twitch.tv/?channel=${encodeURIComponent(username)}&${parentParams}&autoplay=true&muted=true&quality=480p`
        );
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay; fullscreen');

        streamDiv.appendChild(labelDiv);
        streamDiv.appendChild(iframe);
        container.appendChild(streamDiv);
      });

      this.updateGridLayout();
    }
  }

  calculateGrid(streamCount) {
    if (streamCount === 0) return { cols: 1, rows: 1 };
    if (streamCount === 1) return { cols: 1, rows: 1 };
    if (streamCount === 2) return { cols: 2, rows: 1 };
    if (streamCount === 3) return { cols: 3, rows: 1 };
    if (streamCount === 4) return { cols: 2, rows: 2 };
    if (streamCount <= 6) return { cols: 3, rows: 2 };
    if (streamCount <= 9) return { cols: 3, rows: 3 };
    if (streamCount <= 12) return { cols: 4, rows: 3 };
    if (streamCount <= 16) return { cols: 4, rows: 4 };
    if (streamCount <= 20) return { cols: 5, rows: 4 };
    if (streamCount <= 25) return { cols: 5, rows: 5 };
    if (streamCount <= 30) return { cols: 6, rows: 5 };
    if (streamCount <= 36) return { cols: 6, rows: 6 };

    const cols = Math.ceil(Math.sqrt(streamCount));
    const rows = Math.ceil(streamCount / cols);
    return { cols, rows };
  }

  applyCenteredGrid(streamCount, cols, rows) {
    const container = document.getElementById('streams-container');
    const streams = container.querySelectorAll('.stream');

    streams.forEach(stream => {
      stream.style.gridColumn = '';
      stream.style.gridRow = '';
    });

    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    if (rows > 1 && streamCount % cols !== 0) {
      const itemsInLastRow = streamCount % cols;
      const totalEmptyCellsInLastRow = cols - itemsInLastRow;
      const offsetFromStart = Math.floor(totalEmptyCellsInLastRow / 2) + 1;
      const startIndexForLastRow = (rows - 1) * cols;

      for (let i = 0; i < itemsInLastRow; i++) {
        const currentStreamIndex = startIndexForLastRow + i;
        if (streams[currentStreamIndex]) {
          streams[currentStreamIndex].style.gridColumnStart = 
            `${offsetFromStart + i}`;
        }
      }
    }
  }

  updateGridLayout() {
    const streamCount = this.currentStreams.size;
    if (streamCount === 0) return;
    
    const grid = this.calculateGrid(streamCount);
    this.applyCenteredGrid(streamCount, grid.cols, grid.rows);
  }

  resetCountdown() {
    this.countdown = 60;
    this.updateCountdownDisplay();
  }

  updateCountdownDisplay() {
    if (!this.hideHeader) {
      const statusEl = document.getElementById('status');
      statusEl.innerHTML = 
        `Next check in <span id="timer">${this.countdown}</span>s`;
    }
    
    const noStreamsTimer = document.getElementById('no-streams-timer');
    if (noStreamsTimer) {
      noStreamsTimer.textContent = this.countdown;
    }
  }

  startCountdown() {
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      this.updateCountdownDisplay();

      if (this.countdown <= 0) {
        this.checkStreams();
      }
    }, 1000);
  }

  autoHideHeader() {
    if (!this.headerVisible) return;
    
    this.headerVisible = false;
    document.getElementById('header').classList.add('hidden');
    document.getElementById('streams-container').classList.add('fullscreen');
    document.getElementById('no-streams').classList.add('fullscreen');
  }

  showHeader() {
    if (this.headerVisible) return;
    
    this.headerVisible = true;
    document.getElementById('header').classList.remove('hidden');
    document.getElementById('streams-container').classList.remove('fullscreen');
    document.getElementById('no-streams').classList.remove('fullscreen');
  }

  startTracking() {
  this.checkStreams();
  this.startCountdown();
  
  // Show header on hover near top
  if (!this.hideHeader) {
    // Create a trigger overlay at the top
    const trigger = document.createElement('div');
    trigger.className = 'header-trigger';
    document.body.appendChild(trigger);
    
    trigger.addEventListener('mouseenter', () => {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      this.showHeader();
      trigger.classList.remove('active');
    });
    
    // Watch for when header should be hidden
    document.addEventListener('mousemove', (e) => {
      if (e.clientY > 150 && this.headerVisible) {
        // Mouse moved away - schedule hide
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => {
          this.autoHideHeader();
          trigger.classList.add('active');
        }, 2000);
      }
    });
    
    // Initially hide after 5 seconds (trigger should be active after hide)
    setTimeout(() => {
      if (this.autoHideTriggered) {
        trigger.classList.add('active');
      }
    }, 5000);
  }
}
}

// Initialize the app
new TTVVideoWall();