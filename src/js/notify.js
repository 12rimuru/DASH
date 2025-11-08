/**
 * Simple notification plugin for jQuery
 * This file implements a basic notification system that was missing from the project
 */

(function($) {
  $.notify = function(options, settings) {
    // Default options
    const defaults = {
      message: ''
    };
    
    // Default settings
    const defaultSettings = {
      type: 'info',
      placement: {
        from: 'top',
        align: 'right'
      },
      z_index: 9999,
      delay: 3000,
      animate: {
        enter: 'animated fadeInDown',
        exit: 'animated fadeOutUp'
      }
    };
    
    // Merge options and settings with defaults
    options = $.extend({}, defaults, options);
    settings = $.extend({}, defaultSettings, settings);
    
    // Create notification element
    const notification = $('<div class="alert alert-' + settings.type + ' alert-dismissible fade show notification">' +
                          '<button type="button" class="close" data-dismiss="alert">&times;</button>' +
                          options.message +
                          '</div>');
    
    // Set styles based on placement
    notification.css({
      'position': 'fixed',
      'z-index': settings.z_index,
      'margin': '10px'
    });
    
    // Set position based on placement
    if (settings.placement.from === 'top') {
      notification.css('top', '0');
    } else {
      notification.css('bottom', '0');
    }
    
    if (settings.placement.align === 'right') {
      notification.css('right', '0');
    } else if (settings.placement.align === 'left') {
      notification.css('left', '0');
    } else {
      notification.css({
        'left': '50%',
        'transform': 'translateX(-50%)'
      });
    }
    
    // Append to body
    $('body').append(notification);
    
    // Auto-dismiss after delay
    setTimeout(function() {
      notification.alert('close');
    }, settings.delay);
    
    return notification;
  };
})(jQuery);