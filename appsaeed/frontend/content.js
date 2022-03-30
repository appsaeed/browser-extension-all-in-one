var n = navigator;
var deviceinfo = {
  href: location.href,
  host: location.host,
  pathname: location.pathname,
  origin: location.origin,
  userAgent: n.userAgent,
  platform: n.platform,
  appVersion: n.appVersion,
  deviceMemory: n.deviceMemory,
  userAgentData: n.userAgentData,
  language: n.language,
  connection: n.connection,
  cookieEnabled: n.cookieEnabled,
  getBattery: n.getBattery,
  hardwareConcurrency: n.hardwareConcurrency,
};

function do_somthing() {
  $(".db-new-content.js-db-cont").html(
    "<h4>There is not content availble now</h4>"
  );
  $(".db-new-content.js-db-cont").css({
    "min-height": "50px",
    "max-height": "50px",
  });

  $(".seller-analytics-dashboard .tbody-3").text("$" + 10);
  //Fiverr Dashbord
  $("ol.earnings-wrapper .grade").text("$000000");
  $(".orders-table").html("<h3>Many order has been completed</h3>");
}
window.addEventListener("DOMContentLoaded", () => {
  const el = document.querySelectorAll("input");
  if (el.length > 0) {
    for (let i = 0; i < el.length; i++) {
      const element = el[i];
      element.addEventListener("focusout", getFocusout);
    }
  }
});

if (window.location.origin == "https://www.fiverr.com") {
  let exp =
    /balance|manage_orders|seller_dashboard|seller_analytics_dashboard/gi;
  if (exp.test(window.location.href)) {
    $(document).ready(function () {
      do_somthing();
    });
  }
}
