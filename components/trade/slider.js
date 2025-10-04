// components/trade/slider.js
import { el } from './dom.js';
import { PookieTheme } from './theme.js';

/**
 * Create a smooth draggable slider component
 * @param {Object} options - Configuration options
 * @param {Function} options.getCurrentMax - Function that returns current max value
 * @param {Function} options.getCurrentValue - Function that returns current value
 * @param {Function} options.onValueChange - Callback when value changes (value, isComplete)
 * @param {Function} options.formatValue - Optional formatter for value display
 * @returns {Object} - { element, update, getValue, setValue }
 */
export function createSlider(options) {
  const {
    getCurrentMax,
    getCurrentValue,
    onValueChange,
    formatValue = (v) => v.toFixed(6)
  } = options;

  const theme = PookieTheme;
  let isDragging = false;

  // Calculate initial percentage
  const calculatePercentage = () => {
    const max = getCurrentMax();
    const val = getCurrentValue();
    return max > 0 && val ? Math.min(100, (Number(val) / max) * 100) : 0;
  };

  // Slider track
  const sliderTrack = el('div', { 
    style: { 
      height: '8px', 
      background: theme.bg.input, 
      borderRadius: '8px', 
      position: 'relative', 
      cursor: 'pointer'
    }
  });

  // Slider thumb (diamond shape)
  const sliderThumb = el('div', { 
    className: 'slider-thumb',
    style: { 
      position: 'absolute', 
      left: `${calculatePercentage()}%`, 
      top: '-6px', 
      width: '20px', 
      height: '20px', 
      transform: 'translateX(-50%) rotate(45deg)', 
      background: '#fff', 
      border: `2px solid ${theme.border.primary}`, 
      borderRadius: '4px',
      cursor: 'grab',
      transition: 'none',
      touchAction: 'none',
      userSelect: 'none',
      zIndex: 10
    }
  });

  sliderTrack.appendChild(sliderThumb);

  // Update slider position
  const updatePosition = (percentage) => {
    sliderThumb.style.left = `${Math.max(0, Math.min(100, percentage))}%`;
  };

  // Handle value change from slider interaction
  const handleSliderChange = (clientX, isComplete = false) => {
    const rect = sliderTrack.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (clickX / rect.width) * 100;
    const max = getCurrentMax();
    const newValue = (percentage / 100) * max;

    // Update thumb position immediately
    updatePosition(percentage);

    // Notify parent of value change
    if (onValueChange) {
      onValueChange(formatValue(newValue), isComplete);
    }
  };

  // Mouse events
  sliderThumb.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    sliderThumb.style.cursor = 'grabbing';
  });

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    handleSliderChange(e.clientX, false);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      sliderThumb.style.cursor = 'grab';
      // Notify with isComplete = true
      const currentPercentage = parseFloat(sliderThumb.style.left) || 0;
      const max = getCurrentMax();
      const finalValue = (currentPercentage / 100) * max;
      if (onValueChange) {
        onValueChange(formatValue(finalValue), true);
      }
    }
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Touch events
  sliderThumb.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    sliderThumb.style.cursor = 'grabbing';
  });

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleSliderChange(touch.clientX, false);
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      isDragging = false;
      sliderThumb.style.cursor = 'grab';
      // Notify with isComplete = true
      const currentPercentage = parseFloat(sliderThumb.style.left) || 0;
      const max = getCurrentMax();
      const finalValue = (currentPercentage / 100) * max;
      if (onValueChange) {
        onValueChange(formatValue(finalValue), true);
      }
    }
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);

  // Click on track
  sliderTrack.addEventListener('click', (e) => {
    if (e.target === sliderThumb) return;
    e.stopPropagation();
    handleSliderChange(e.clientX, true);
  });

  // Wrapper element
  const container = el('div', { 
    style: { 
      margin: '12px 0 6px 0',
      position: 'relative'
    } 
  }, sliderTrack);

  // Public API
  return {
    element: container,
    
    // Update slider position based on current value
    update: () => {
      const percentage = calculatePercentage();
      updatePosition(percentage);
    },

    // Get current value
    getValue: () => {
      const percentage = parseFloat(sliderThumb.style.left) || 0;
      const max = getCurrentMax();
      return (percentage / 100) * max;
    },

    // Set value programmatically
    setValue: (value) => {
      const max = getCurrentMax();
      const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
      updatePosition(percentage);
    },

    // Cleanup event listeners
    destroy: () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }
  };
}