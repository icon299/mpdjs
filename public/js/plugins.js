// Avoid `console` errors in browsers that lack a console.

var iWebkit;
if(!iWebkit){
  iWebkit=window.onload=function(){
    function fullscreen(){var a=document.getElementsByTagName("a");
        for(var i=0;i<a.length;i++){
            if(a[i].className.match("noeffect")){
            }
            else {a[i].onclick=function(){
                    window.location=this.getAttribute("href");
                    return false
                }
            }
        }
    }

        function hideURLbar(){
          window.scrollTo(0,0.9)
        }
        iWebkit.init=function(){
          fullscreen();
          hideURLbar()
        };

        iWebkit.init()
    }
}

(function() {
    var method;
    var noop = function () {};
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Place any jQuery/helper plugins in here.
