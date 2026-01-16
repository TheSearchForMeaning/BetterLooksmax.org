/**
 * Grey User Filter Plugin for BetterLooksmax
 * Hide content from grey users and custom user groups
 */

export default {
    id: 'grey-user-filter',
    name: 'Grey User Filter',
    description: 'Hide threads, posts, and members from grey users or specific username styles',
    version: '1.0.0',
    author: 'BetterLooksmax',
    category: 'filter',
    tags: ['filter', 'users', 'content'],
    
    settings: {
      enabled: {
        type: 'boolean',
        default: false,
        title: 'Enable Grey User Filter',
        description: 'Hide content from grey users',
        section: 'General'
      },
      hideThreads: {
        type: 'boolean',
        default: true,
        title: 'Hide Threads',
        description: 'Hide threads started by filtered users',
        section: 'Content Types'
      },
      hidePosts: {
        type: 'boolean',
        default: true,
        title: 'Hide Posts',
        description: 'Hide posts made by filtered users',
        section: 'Content Types'
      },
      hideMembers: {
        type: 'boolean',
        default: true,
        title: 'Hide from Member Lists',
        description: 'Hide filtered users from member lists',
        section: 'Content Types'
      },
      usernameStyles: {
        type: 'string',
        default: '.username--style2, .username--style7, .username--style19',
        title: 'Username Style Selectors',
        description: 'CSS selectors for username styles to filter (comma-separated)',
        section: 'Advanced',
        placeholder: '.username--style2, .username--style7'
      },
      customUsernames: {
        type: 'string',
        default: '',
        title: 'Custom Usernames to Filter',
        description: 'Specific usernames to hide (comma-separated, case-insensitive)',
        section: 'Custom Filters',
        placeholder: 'username1, username2, username3'
      },
      useWhitelist: {
        type: 'boolean',
        default: false,
        title: 'Use Whitelist Mode',
        description: 'Instead of hiding, ONLY show users matching the filters',
        section: 'Advanced'
      },
      showCount: {
        type: 'boolean',
        default: true,
        title: 'Show Hidden Count',
        description: 'Display count of hidden items in console',
        section: 'General'
      }
    },
  
    // Plugin state
    state: {
      isActive: false,
      button: null,
      observer: null,
      hiddenElements: new Set(),
      processedElements: new WeakSet(),
      hiddenCount: { threads: 0, posts: 0, members: 0 }
    },
  
    async init(api) {
      api.utils.logger.info('Grey User Filter plugin initializing...');
    },
  
    async start(api) {
      const enabled = api.settings.get('enabled');
      
      // Create and inject the filter button
      this.createButton(api);
      
      // Apply filter if it was previously enabled
      if (enabled) {
        this.state.isActive = true;
        this.applyFilter(api);
        this.updateButtonState(api, true);
      }
      
      // Watch for setting changes
      api.settings.watch('enabled', (newVal) => {
        this.state.isActive = newVal;
        if (newVal) {
          this.applyFilter(api);
        } else {
          this.removeFilter(api);
        }
        this.updateButtonState(api, newVal);
      });
      
      // Re-apply filter when filter settings change
      const filterSettings = ['hideThreads', 'hidePosts', 'hideMembers', 'usernameStyles', 'customUsernames', 'useWhitelist'];
      filterSettings.forEach(setting => {
        api.settings.watch(setting, () => {
          if (this.state.isActive) {
            this.reapplyFilter(api);
          }
        });
      });
      
      // Setup mutation observer for dynamic content
      this.setupObserver(api);
      
      api.utils.logger.info('Grey User Filter plugin started');
    },
  
    async stop(api) {
      // Remove filter if active
      if (this.state.isActive) {
        this.removeFilter(api);
      }
      
      // Remove button
      if (this.state.button) {
        api.dom.remove(this.state.button);
        this.state.button = null;
      }
      
      // Disconnect observer
      if (this.state.observer) {
        this.state.observer.disconnect();
        this.state.observer = null;
      }
      
      // Clear state
      this.state.hiddenElements.clear();
      this.state.processedElements = new WeakSet();
      this.state.hiddenCount = { threads: 0, posts: 0, members: 0 };
      
      api.utils.logger.info('Grey User Filter plugin stopped');
    },
  
    async destroy(api) {
      await api.storage.remove('greyFilterState');
      api.utils.logger.info('Grey User Filter plugin destroyed');
    },
  
    // Create the filter toggle button
    createButton(api) {
      const button = document.createElement('a');
      button.href = '#';
      button.className = 'p-navgroup-link p-navgroup-link--iconic grey-users-button';
      button.setAttribute('title', 'Grey User Filter');
      button.setAttribute('aria-label', 'Grey User Filter');
  
      const icon = document.createElement('i');
      icon.setAttribute('aria-hidden', 'true');
      icon.className = 'fas fa-user-slash';
      icon.style.fontSize = '16px';
      button.appendChild(icon);
  
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle(api);
      });
  
      // Find navigation group and insert button
      const navGroup = document.querySelector('.p-navgroup.p-discovery') || 
                      document.querySelector('.p-navgroup');
      if (navGroup) {
        const searchButton = navGroup.querySelector('.p-navgroup-link--search');
        if (searchButton) {
          navGroup.insertBefore(button, searchButton);
        } else {
          navGroup.appendChild(button);
        }
        this.state.button = button;
      }
    },
  
    // Toggle filter
    async toggle(api) {
      this.state.isActive = !this.state.isActive;
      await api.settings.set('enabled', this.state.isActive);
      
      api.ui.createNotification({
        message: this.state.isActive ? 'Grey User Filter Enabled' : 'Grey User Filter Disabled',
        type: this.state.isActive ? 'success' : 'info',
        duration: 2000
      });
    },
  
    // Update button appearance
    updateButtonState(api, isActive) {
      if (!this.state.button) return;
      
      this.state.button.classList.toggle('is-active', isActive);
      const icon = this.state.button.querySelector('i');
      if (icon) {
        icon.className = isActive ? 'fas fa-user-check' : 'fas fa-user-slash';
        this.state.button.setAttribute('title', isActive ? 'Disable Grey User Filter' : 'Enable Grey User Filter');
        this.state.button.setAttribute('aria-label', isActive ? 'Disable Grey User Filter' : 'Enable Grey User Filter');
      }
    },
  
    // Setup mutation observer for dynamic content
    setupObserver(api) {
      const throttledProcess = api.utils.throttle(() => {
        if (this.state.isActive) {
          this.hideContent(api);
        }
      }, 300);
  
      this.state.observer = new MutationObserver((mutations) => {
        // Check if any relevant nodes were added
        let hasRelevantNodes = false;
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE && (
                node.matches?.('.structItem, .message, .listInline--comma li') ||
                node.querySelector?.('.structItem, .message, .listInline--comma li')
              )) {
                hasRelevantNodes = true;
                break;
              }
            }
          }
          if (hasRelevantNodes) break;
        }
        
        if (hasRelevantNodes) {
          throttledProcess();
        }
      });
  
      this.state.observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    },
  
    // Apply filter
    applyFilter(api) {
      this.injectStyles(api);
      this.hideContent(api);
      
      if (api.settings.get('showCount')) {
        const { threads, posts, members } = this.state.hiddenCount;
        api.utils.logger.info(`Hidden: ${threads} threads, ${posts} posts, ${members} members`);
      }
    },
  
    // Remove filter
    removeFilter(api) {
      api.dom.removeStyle('grey-filter-styles');
      this.restoreHiddenElements(api);
      this.state.hiddenCount = { threads: 0, posts: 0, members: 0 };
    },
  
    // Re-apply filter (when settings change)
    reapplyFilter(api) {
      this.restoreHiddenElements(api);
      this.state.processedElements = new WeakSet();
      this.state.hiddenCount = { threads: 0, posts: 0, members: 0 };
      this.applyFilter(api);
    },
  
    // Inject CSS styles
    injectStyles(api) {
      const styles = `
        .hidden-grey-user {
          display: none !important;
        }
      `;
      api.dom.style(styles, 'grey-filter-styles');
    },
  
    // Check if user should be filtered
    shouldFilterUser(api, element) {
      const usernameStyles = api.settings.get('usernameStyles')
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
      
      const customUsernames = api.settings.get('customUsernames')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s);
      
      const useWhitelist = api.settings.get('useWhitelist');
      
      // Check username style
      let matchesStyle = false;
      if (usernameStyles.length > 0) {
        const styleSelector = usernameStyles.join(', ');
        matchesStyle = element.querySelector(styleSelector) !== null;
      }
      
      // Check custom usernames
      let matchesUsername = false;
      if (customUsernames.length > 0) {
        const usernameElement = element.querySelector('.username');
        if (usernameElement) {
          const username = usernameElement.textContent.trim().toLowerCase();
          matchesUsername = customUsernames.includes(username);
        }
      }
      
      const isMatch = matchesStyle || matchesUsername;
      
      // Return based on whitelist/blacklist mode
      return useWhitelist ? !isMatch : isMatch;
    },
  
    // Hide all filtered content
    hideContent(api) {
      if (api.settings.get('hideThreads')) {
        this.hideThreads(api);
      }
      if (api.settings.get('hidePosts')) {
        this.hidePosts(api);
      }
      if (api.settings.get('hideMembers')) {
        this.hideMembers(api);
      }
    },
  
    // Hide threads
    hideThreads(api) {
      const threads = document.querySelectorAll('.structItem:not(.hidden-grey-user)');
      
      threads.forEach(thread => {
        if (this.state.processedElements.has(thread)) return;
        
        const structItemParts = thread.querySelector('.structItem-parts');
        if (structItemParts && this.shouldFilterUser(api, structItemParts)) {
          thread.style.display = 'none';
          thread.classList.add('hidden-grey-user');
          this.state.hiddenElements.add(thread);
          this.state.processedElements.add(thread);
          this.state.hiddenCount.threads++;
        }
      });
    },
  
    // Hide posts
    hidePosts(api) {
      const posts = document.querySelectorAll('.message:not(.hidden-grey-user)');
      
      posts.forEach(post => {
        if (this.state.processedElements.has(post)) return;
        
        if (this.shouldFilterUser(api, post)) {
          post.style.display = 'none';
          post.classList.add('hidden-grey-user');
          this.state.hiddenElements.add(post);
          this.state.processedElements.add(post);
          this.state.hiddenCount.posts++;
        }
      });
    },
  
    // Hide members from lists
    hideMembers(api) {
      const members = document.querySelectorAll('.listInline--comma li:not(.hidden-grey-user)');
      
      members.forEach(member => {
        if (this.state.processedElements.has(member)) return;
        
        if (this.shouldFilterUser(api, member)) {
          member.style.display = 'none';
          member.classList.add('hidden-grey-user');
          member.setAttribute('data-grey-hidden', 'true');
          this.state.hiddenElements.add(member);
          this.state.processedElements.add(member);
          this.state.hiddenCount.members++;
        }
      });
    },
  
    // Restore hidden elements
    restoreHiddenElements(api) {
      // Restore all hidden elements
      const allHidden = document.querySelectorAll('.hidden-grey-user, [data-grey-hidden="true"]');
      
      allHidden.forEach(element => {
        element.style.display = '';
        element.classList.remove('hidden-grey-user');
        element.removeAttribute('data-grey-hidden');
      });
      
      this.state.hiddenElements.clear();
    }
  };