$(function () {
    $(document).tooltip();
    $(".widget input[type=submit], .widget a, .widget button").button();
    $("button, a").click(function (event) { });
});
$(function () {
    var x = 0;
    setInterval(function () {
        x -= 5;
        if (Number($('body').css('background-position-x').replace("px", "")) < -5000) {
            $('body').css('background-position', '0px 0');
            x = 0;
        } else {
            $('body').css('background-position', x + 'px 0');
        }
    }, 100);
});