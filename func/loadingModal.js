// func/loadingModal.js
// Professional Loading Modal System with State Management

import { PookieTheme } from '../components/trade/theme.js';

// State management
let currentModal = null;
let autoHideTimer = null;
let isHiding = false;

function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  const { style, onclick, ...attrs } = props;
  
  if (style) Object.assign(element.style, style);
  if (onclick) element.onclick = onclick;
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      element.setAttribute(key, value);
    }
  });
  
  children.flat().forEach(child => {
    if (child) {
      element.appendChild(
        typeof child === 'string' ? document.createTextNode(child) : child
      );
    }
  });
  
  return element;
}

/**
 * Clear any existing auto-hide timer
 */
function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

/**
 * Show loading modal
 * @param {string} message - Main message
 * @param {string} type - 'loading' | 'success' | 'error' | 'info'
 * @param {number} autoHideDuration - Auto-hide after ms (0 = no auto-hide)
 */
export function showLoadingModal(message = 'Processing...', type = 'loading', autoHideDuration = 0) {
  // Clear any pending operations
  clearAutoHideTimer();
  isHiding = false;
  
  // Hide existing modal first
  if (currentModal) {
    hideLoadingModal(true); // Force immediate hide
  }

  const theme = PookieTheme;

  // Spinner container
  const spinner = el('div', {
    style: {
      width: '100px',
      height: '100px',
      position: 'relative',
      margin: '0 auto 24px'
    }
  });

  // Animated circle
  const spinnerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  spinnerCircle.setAttribute('width', '100');
  spinnerCircle.setAttribute('height', '100');
  spinnerCircle.setAttribute('viewBox', '0 0 100 100');
  spinnerCircle.style.position = 'absolute';
  spinnerCircle.style.top = '0';
  spinnerCircle.style.left = '0';

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '45');
  circle.setAttribute('fill', 'none');
  
  // Color based on type
  let strokeColor = theme.brand.green;
  if (type === 'error') strokeColor = theme.brand.red;
  if (type === 'success') strokeColor = theme.brand.altGreen;
  if (type === 'info') strokeColor = '#FFD24D';
  
  circle.setAttribute('stroke', strokeColor);
  circle.setAttribute('stroke-width', '4');
  circle.setAttribute('stroke-linecap', 'round');
  circle.setAttribute('stroke-dasharray', '200 80');
  
  // Only animate if loading
  if (type === 'loading') {
    const animateTransform = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    animateTransform.setAttribute('attributeName', 'transform');
    animateTransform.setAttribute('type', 'rotate');
    animateTransform.setAttribute('from', '0 50 50');
    animateTransform.setAttribute('to', '360 50 50');
    animateTransform.setAttribute('dur', '1.5s');
    animateTransform.setAttribute('repeatCount', 'indefinite');
    circle.appendChild(animateTransform);
  }

  spinnerCircle.appendChild(circle);
  spinner.appendChild(spinnerCircle);

  // Logo
  const logoImg = el('img', {
    src: '../assets/pookieLogo.webp',
    alt: 'Pookie',
    style: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      background: theme.bg.card,
      border: `3px solid ${theme.border.primary}`,
      padding: '5px',
      zIndex: 1,
      objectFit: 'cover'
    }
  });

  logoImg.onerror = function() {
    this.style.display = 'none';
    const fallback = el('div', {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: theme.bg.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        fontWeight: 900,
        color: strokeColor,
        border: `3px solid ${theme.border.primary}`,
        zIndex: 1
      }
    }, 'P');
    spinner.appendChild(fallback);
  };

  spinner.appendChild(logoImg);

  // Message
  const messageText = el('div', {
    className: 'loading-message-text',
    style: {
      fontSize: '18px',
      fontWeight: 800,
      color: theme.text.primary,
      textAlign: 'center',
      marginBottom: '8px',
      lineHeight: '1.4',
      transition: 'all 0.3s ease'
    }
  }, message);

  // Sub-message
  const subText = el('div', {
    className: 'loading-sub-text',
    style: {
      fontSize: '14px',
      color: theme.text.muted,
      textAlign: 'center',
      opacity: type === 'loading' ? 1 : 0,
      transition: 'opacity 0.3s ease',
      lineHeight: '1.4',
      minHeight: '20px'
    }
  }, type === 'loading' ? 'Please wait...' : '');

  // Modal overlay
  const modal = el('div', {
    className: 'loading-modal-overlay',
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease',
      opacity: 0
    }
  });

  // Content card
  const content = el('div', {
    className: 'loading-modal-content',
    style: {
      background: theme.bg.card,
      borderRadius: '24px',
      padding: '48px 40px',
      minWidth: '320px',
      maxWidth: '420px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
      animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      border: `1px solid ${theme.border.primary}`,
      transform: 'scale(0.8)',
      opacity: 0
    }
  },
    spinner,
    messageText,
    subText
  );

  modal.appendChild(content);

  // Add animations CSS
  if (!document.getElementById('loading-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-modal-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes scaleOut {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(0.9); opacity: 0; }
      }
      .loading-modal-overlay { opacity: 1 !important; }
      .loading-modal-content { transform: scale(1) !important; opacity: 1 !important; }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(modal);

  // Force reflow for animation
  modal.offsetHeight;
  modal.style.opacity = '1';
  content.style.transform = 'scale(1)';
  content.style.opacity = '1';

  currentModal = {
    modal,
    messageText,
    subText,
    logoImg,
    spinnerCircle,
    circle,
    type
  };

  console.log('[loadingModal] Shown:', { message, type, autoHideDuration });

  // Auto-hide for success/error
  if (autoHideDuration > 0) {
    autoHideTimer = setTimeout(() => {
      hideLoadingModal();
    }, autoHideDuration);
  }

  return currentModal;
}

/**
 * Update message without recreating modal
 */
export function updateLoadingMessage(message, subMessage = '') {
  if (!currentModal || !currentModal.messageText) {
    console.warn('[loadingModal] Cannot update: modal not found');
    return;
  }

  console.log('[loadingModal] Update:', { message, subMessage });

  currentModal.messageText.textContent = message;
  
  if (currentModal.subText) {
    if (subMessage) {
      currentModal.subText.textContent = subMessage;
      currentModal.subText.style.opacity = '1';
    } else {
      currentModal.subText.style.opacity = '0';
    }
  }
}

/**
 * Change loading type (color + animation)
 */
export function setLoadingType(type) {
  if (!currentModal || !currentModal.circle) {
    console.warn('[loadingModal] Cannot set type: modal not found');
    return;
  }

  console.log('[loadingModal] Set type:', type);

  const theme = PookieTheme;
  let strokeColor = theme.brand.green;
  if (type === 'error') strokeColor = theme.brand.red;
  if (type === 'success') strokeColor = theme.brand.altGreen;
  if (type === 'info') strokeColor = '#FFD24D';
  
  currentModal.circle.setAttribute('stroke', strokeColor);
  currentModal.type = type;
  
  // Remove animation for non-loading states
  if (type !== 'loading') {
    const animations = currentModal.circle.getElementsByTagName('animateTransform');
    while (animations.length > 0) {
      animations[0].remove();
    }
  }
}

/**
 * Hide loading modal
 * @param {boolean} immediate - Skip animation
 */
export function hideLoadingModal(immediate = false) {
  clearAutoHideTimer();

  if (!currentModal || !currentModal.modal || isHiding) {
    return;
  }

  isHiding = true;
  console.log('[loadingModal] Hiding...', { immediate });

  if (immediate) {
    // Immediate removal
    if (currentModal.modal.parentNode) {
      currentModal.modal.remove();
    }
    currentModal = null;
    isHiding = false;
    return;
  }

  // Animated removal
  currentModal.modal.style.animation = 'fadeOut 0.2s ease';
  if (currentModal.modal.querySelector('.loading-modal-content')) {
    currentModal.modal.querySelector('.loading-modal-content').style.animation = 'scaleOut 0.2s ease';
  }

  setTimeout(() => {
    if (currentModal && currentModal.modal && currentModal.modal.parentNode) {
      currentModal.modal.remove();
    }
    currentModal = null;
    isHiding = false;
    console.log('[loadingModal] Hidden');
  }, 220);
}

/**
 * Check if modal is currently showing
 */
export function isLoadingModalVisible() {
  return currentModal !== null && !isHiding;
}

/**
 * Force cleanup (use in emergency)
 */
export function forceCleanup() {
  clearAutoHideTimer();
  const modals = document.querySelectorAll('.loading-modal-overlay');
  modals.forEach(m => m.remove());
  currentModal = null;
  isHiding = false;
  console.log('[loadingModal] Force cleanup executed');
}