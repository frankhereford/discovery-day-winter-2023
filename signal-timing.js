/*
- This Javascript file contains a variety of functionality related to displaying, updating, and interacting with a set
of transportation-related data, including annual goals, system retiming, travel time reduction and stop reduction for
different years.
- Key features include:
    - Defining annual goals for different years from 2015 to 2025. Goals include
'retime_goal', 'travel_time_reduction', and 'stops_reduction'.
    - Defining display column names for a table ('Corridor
Name', 'Number of Signals', etc.)
    - Setting up URLs for downloading data related to system retiming, system
intersections and other log data from the Austin city government.
    - Defining file-specific status types, styles,
color indices and other variables e.g. for D3 charting.
    - Creating functions to group and format data, create charts,
update tables, and manage modals/pop-ups.
    - Creating functions to populate tables and maps with data fetched based on
the selected year and status.
    - Several actions are tied to window resizing events – resizing the display table,
expanding and collapsing maps
*/

var ANNUAL_GOALS = {
  2025: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2024: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2023: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2022: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2021: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2020: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2019: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2018: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0
  },
  2017: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 3
  },
  2016: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 0.1
  },
  2015: {
    retime_goal: 0,
    travel_time_reduction: 0.05,
    stops_reduction: 6
  }
};
var table_cols = ["Corridor Name", "Number of Signals", "Status", "Travel Time Change", "Engineer Note"];
var SYSTEM_RETIMING_URL = "https://data.austintexas.gov/resource/g8w2-8uap.json?$limit=10000";
var SYSTEM_INTERSECTIONS_URL = "https://data.austintexas.gov/resource/efct-8fs9.json?$limit=10000";
var LOGFILE_URL = "https://api.mobility.austin.gov/jobs?name=eq.signal_retiming&status=eq.success&order=start_date.desc&&records_processed=gt.0&limit=1";
var STATUS_SELECTED = "COMPLETED";
var SOURCE_DATA_SYSTEMS;
var GROUPED_RETIMING_DATA;
var GROUPED_DATA_INTERSECTIONS;
var UNIQUE_SIGNALS_RETIMED = {};
var SYSTEM_IDS = {};
var tau = 2 * Math.PI,
  arc;
var selected_year;
var previous_selection = "2015";
var formatPct = d3.format(".1%");
var formatPctInt = d3.format("1.0%");
var formatDate = d3.timeFormat("%x");
var formatTime = d3.timeFormat("%-I:%M %p");
var formatSeconds = d3.timeFormat("%Mm %Ss");
var FORMAT_TYPES = {
  retiming_progress: formatPctInt,
  travel_time_reduction: formatPct,
  stops_reduction: formatPct
};
var STATUS_TYPES_READABLE = {
  "READY FOR DATA COLLECTION": "In Progress",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  "WAITING FOR EVALUATION": "Waiting for Post-Retiming Evaluation"
};
var show_modal = false;
var t1_duration = 1200;
var t1 = d3.transition().ease(d3.easeQuad).duration(t1_duration);
var t2_duration = 1000;
var t2, map, curr_breakpoint;
var color_index = 0.9;
var HIGHLIGHT_STYLE = {
  color: "#fff",
  weight: 1,
  fillColor: "#d95f02",
  fillOpacity: 0.9
};
var DEFAULT_STYLE = {
  color: "#fff",
  weight: 1,
  fillColor: "#7570b3",
  fillOpacity: 0.8
};
var SCALE_THRESHOLDS = {
  $1: 500,
  $2: 500,
  $3: 500,
  $4: 500,
  $5: 500,
  $6: 500,
  $7: 500,
  $8: 500,
  $9: 500,
  $10: 500,
  $11: 400,
  $12: 250,
  $13: 150,
  $14: 100,
  $15: 50,
  $16: 40,
  $17: 25,
  $18: 10,
  $19: 10,
  $20: 10
};
var SIGNAL_MARKERS = [];
var map_expanded = false;
var SYSTEMS_LAYERS = {};
var visible_layers = new L.featureGroup();
var table_height = "60vh";
$(document).ready(function () {
  if (is_touch_device()) {
    d3.select(".map").style("margin-right", "10px").style("margin-left", "10px");
  }
});
var collapsed_class = "col-sm-6";
var expanded_class = "col-sm-12";
$("#dashModal").on("shown.bs.modal", function () {
  map.invalidateSize();
});
d3.json(SYSTEM_RETIMING_URL, function (dataset) {
  $("#map_selectors").append('<div class="col" id="map_selector_container"></div>');
  $("#map_selector_container").append('<div class="row"><div class="col"><h5> Fiscal Year <i class="fa fa-info-circle" data-container="body" data-trigger="hover" data-toggle="popover" data-placement="right" data-content="The City of Austin Fiscal Year Begins on October 1." data-original-title="" title=""></i></h5></div></div>');
  SOURCE_DATA_SYSTEMS = dataset;
  d3.json(SYSTEM_INTERSECTIONS_URL, function (dataset_2) {
    GROUPED_DATA_INTERSECTIONS = dataset_2;
    groupData(SOURCE_DATA_SYSTEMS, function () {
      createProgressChart("info-2", "retiming_progress");
      populateInfoStat("info-3", "travel_time_reduction", t1);
      var cols = createTableCols("data_table", table_cols);
      populateTable(SOURCE_DATA_SYSTEMS, function () {
        $(function () {
          $('[data-toggle="popover"]').popover();
        });
        getLogData(LOGFILE_URL);
        createTableListeners();
        resizedw();
        var resize_timer;
        window.onresize = function () {
          clearTimeout(resize_timer);
          resize_timer = setTimeout(resizedw, 100);
        };
        makeMap(GROUPED_DATA_INTERSECTIONS, function (map, dataset) {
          populateMap(map, dataset);
          map.on("zoomend", function () {
            setMarkerSizes();
          });
        });
      });
      $("#search_input").on("keyup", function () {
        table.search(this.value).draw();
      });
    });
  });
});
/*Aggregates signal retiming data by fiscal year and status, calculates related
statistics, updates annual goals, and sets up yearly selector UI interactions.*/
function groupData(dataset, updateCharts) {
  GROUPED_RETIMING_DATA = d3.nest().key(function (d) {
    return d.scheduled_fy;
  }).key(function (q) {
    return q.retime_status;
  }).rollup(function (v) {
    return {
      travel_time_change: d3.sum(v, function (d) {
        return d.vol_wavg_tt_seconds;
      }) / d3.sum(v, function (d) {
        return d.total_vol;
      }),
      signals_retimed: d3.sum(v, function (d) {
        return d.signal_count;
      })
    };
  }).map(dataset);
  for (var i in GROUPED_RETIMING_DATA) {
    for (var q in GROUPED_RETIMING_DATA[i]) {
      GROUPED_RETIMING_DATA[i][q]["travel_time_reduction"] = +GROUPED_RETIMING_DATA[i][q]["travel_time_change"];
    }
  }
  var total_planned_signals = {};
  for (var i = 0; i < GROUPED_DATA_INTERSECTIONS.length; i++) {
    for (var q = 0; q < SOURCE_DATA_SYSTEMS.length; q++) {
      var signal_id = parseInt(+GROUPED_DATA_INTERSECTIONS[i].signal_id);
      var system_id_source = +GROUPED_DATA_INTERSECTIONS[i].system_id;
      var system_id_system = +SOURCE_DATA_SYSTEMS[q].system_id;
      if (system_id_source == system_id_system) {
        var fy = "$" + SOURCE_DATA_SYSTEMS[q].scheduled_fy;
        if (!(fy in total_planned_signals)) {
          total_planned_signals[fy] = [];
        }
        if (total_planned_signals[fy].indexOf(signal_id) < 0) {
          total_planned_signals[fy].push(signal_id);
        }
        if (SOURCE_DATA_SYSTEMS[q].retime_status == "COMPLETED" || SOURCE_DATA_SYSTEMS[q].retime_status == "WAITING FOR EVALUATION") {
          if (!(fy in UNIQUE_SIGNALS_RETIMED)) {
            UNIQUE_SIGNALS_RETIMED[fy] = [];
          }
          if (UNIQUE_SIGNALS_RETIMED[fy].indexOf(signal_id) < 0) {
            UNIQUE_SIGNALS_RETIMED[fy].push(signal_id);
          }
        }
      }
    }
  }
  var years = Object.keys(ANNUAL_GOALS);
  for (var z = 0; z < years.length; z++) {
    var year = years[z];
    if (total_planned_signals["$" + year]) {
      ANNUAL_GOALS[year].retime_goal = total_planned_signals["$" + year].length;
    }
  }
  getDefaultYear();
  updateCharts();
  createYearSelectors("map_selector_container", function (selectors) {
    $(".btn-map-selector").on("click", function () {
      $(".btn-map-selector").removeClass("active").attr("aria-pressed", false);
      $(this).addClass("active").attr("aria-pressed", true);
      previous_selection = selected_year;
      selected_year = $(this).attr("value");
      t2 = d3.transition().ease(d3.easeQuad).duration(t2_duration);
      updateProgressChart("info-2", t2);
      updateInfoStat("info-3", "travel_time_reduction", t2);
      populateTable(SOURCE_DATA_SYSTEMS, function () {
        createTableListeners();
      });
      updateVisibleLayers(map);
    });
  });
}
/*Set the `selected_year` variable to the present year or the next year if the
current month is October or later and retime data for the next year exists.*/
function getDefaultYear() {
  var currentDate = new Date();
  var currentMonth = currentDate.getMonth() + 1;
  var currentYear = currentDate.getFullYear();
  if (currentMonth >= 10 && GROUPED_RETIMING_DATA["$" + currentYear + 1]) {
    selected_year = currentYear + 1;
  } else {
    selected_year = currentYear;
  }
}
/*Generates buttons to select different years based on retiming data, sets the
selected year, and attaches event listeners to buttons.*/
function createYearSelectors(divId, createListeners) {
  data = GROUPED_RETIMING_DATA.keys().sort();
  var selectors = d3.select("#" + divId).append("div").attr("class", "row pb-2").append("div").attr("class", "btn-group col").attr("role", "group").selectAll("btn").data(data).enter().append("btn").attr("type", "button").attr("class", "btn btn-primary btn-map-selector").attr("aria-pressed", function (d, i) {
    if (data[i] == selected_year) {
      return true;
    } else {
      return false;
    }
  }).classed("active", function (d, i) {
    if (data[i] == selected_year) {
      return true;
    } else {
      return false;
    }
  }).attr("value", function (d) {
    return d;
  }).html(function (d) {
    return d;
  });
  createListeners(selectors);
}
/*Updates a specified info statistic on the page using D3 transitions, applying
different CSS classes based on the achieved metric compared to the goal, and
smoothly animating the metric from 0 to its current value.*/
function populateInfoStat(divId, metric, transition) {
  var goal = ANNUAL_GOALS[selected_year][metric];
  if (GROUPED_RETIMING_DATA["$" + selected_year]["$" + STATUS_SELECTED]) {
    var metric_value = GROUPED_RETIMING_DATA["$" + selected_year]["$" + STATUS_SELECTED][metric];
  }
  if (!metric_value) {
    var metric_value = 0;
  }
  d3.select("#" + divId).append("text").text(FORMAT_TYPES[metric](0)).transition(transition).attr("class", function () {
    if (metric === "travel_time_reduction" && metric_value > 0) {
      return "positive-reduction info-metric";
    }
    if (metric === "travel_time_reduction" && metric_value <= 0) {
      return "negative-or-no-reduction info-metric";
    }
    if (metric !== "travel_time_reduction" && metric_value >= +goal) {
      return "goal-met info-metric";
    }
    return "goal-unmet info-metric";
  }).tween("text", function () {
    var that = d3.select(this);
    var i = d3.interpolate(0, metric_value);
    return function (t) {
      that.text(FORMAT_TYPES[metric](i(t)));
    };
  });
  d3.select("#" + divId).selectAll(".goal-text").remove();
  d3.select("#" + divId).append("h5").attr("class", "goal-text").text("FY" + selected_year + " Goal: " + FORMAT_TYPES[metric](goal));
}
/*Updates the displayed statistic by transitioning the text element in the DOM
with ID `divId` to reflect the new metric value for the selected year. This
transition also includes changing the text element's class based on whether the
travel time reduction is positive, negative, or if the goal is met/unmet for
other metrics. After transitioning, it displays the goal for the fiscal year as
text below the metric.*/
function updateInfoStat(divId, metric, transition) {
  var goal = ANNUAL_GOALS[selected_year][metric];
  if (GROUPED_RETIMING_DATA["$" + previous_selection]["$" + STATUS_SELECTED]) {
    var metric_value_previous = GROUPED_RETIMING_DATA["$" + previous_selection]["$" + STATUS_SELECTED][metric];
  }
  if (GROUPED_RETIMING_DATA["$" + selected_year]["$" + STATUS_SELECTED]) {
    var metric_value = GROUPED_RETIMING_DATA["$" + selected_year]["$" + STATUS_SELECTED][metric];
  }
  if (!metric_value_previous) {
    var metric_value_previous = 0;
  }
  if (!metric_value) {
    var metric_value = 0;
  }
  d3.select("#" + divId).select("text").transition(transition).attr("class", function () {
    if (metric === "travel_time_reduction" && metric_value > 0) {
      return "positive-reduction info-metric";
    }
    if (metric === "travel_time_reduction" && metric_value <= 0) {
      return "negative-or-no-reduction info-metric";
    }
    if (metric !== "travel_time_reduction" && metric_value >= +goal) {
      return "goal-met info-metric";
    }
    return "goal-unmet info-metric";
  }).tween("text", function () {
    var that = d3.select(this);
    var i = d3.interpolate(metric_value_previous, metric_value);
    return function (t) {
      that.text(FORMAT_TYPES[metric](i(t)));
    };
  });
  d3.select("#" + divId).selectAll(".goal-text").remove();
  d3.select("#" + divId).append("h5").attr("class", "goal-text").text("FY" + selected_year + " Goal: " + FORMAT_TYPES[metric](goal));
}
/*Initializes a progress chart with default values for a specific 'divId' and
'metric' using D3.js, including creating an SVG element with a gray background
arc and a green progress arc that initially shows 0% completion, and then calling
another function to potentially update the chart with actual data.*/
function createProgressChart(divId, metric) {
  var pct_complete = 0;
  var width = 200;
  var height = 200;
  var radius = 100;
  arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius).startAngle(0);
  var svg = d3.select("#" + divId).append("svg").attr("width", width).attr("height", height);
  var g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
  var background = g.append("path").datum({
    endAngle: tau
  }).attr("class", "pie-gray").attr("d", arc);
  var progress = g.append("path").datum({
    endAngle: pct_complete * tau
  }).attr("class", "pie-green").attr("id", "progress-pie").attr("d", arc);
  var pieTextContainer = svg.append("g");
  pieTextContainer.append("text").attr("id", "pieTextLarge").attr("class", "pie-info").attr("y", height / 2).attr("x", width / 2).html(function (d) {
    return formatPctInt(0);
  });
  pieTextContainer.append("text").attr("id", "pieTextSmall").attr("y", height / 1.6).attr("x", width / 2).attr("class", "pie-info-small").html("0 of " + 0);
  updateProgressChart("info-1", t1);
}
/*Appends an update date and time with a link to data source to the specified HTML
element by its ID.*/
function postUpdateDate(log_date, divId) {
  var update_date_time = new Date(log_date);
  update_date = readableDate(update_date_time);
  var update_time = formatTime(update_date_time);
  d3.select("#" + divId).append("div").attr("class", "col justify-content-center text-center").append("h6").html("Updated " + update_date + " at " + update_time + " | <a href='https://data.austintexas.gov/browse?q=traffic+signals' target='_blank'> Data <i  class='fa fa-download'></i> </a>");
}
/*Fetches and processes the start date from a log file URL, then updates the
display element with ID "info-row-1" with the formatted last updated date and
time.*/
function getLogData(url) {
  d3.json(url, function (error, data) {
    postUpdateDate(data[0].start_date, "info-row-1");
  });
}
/*Updates the progress chart by calculating the percentage of completed signal
retimings relative to the annual goal, animating the change in the SVG pie chart
and updating the percentage text displayed.*/
function updateProgressChart(divId, transition) {
  var goal = ANNUAL_GOALS[selected_year]["retime_goal"];
  if (GROUPED_RETIMING_DATA["$" + selected_year]["$" + STATUS_SELECTED]) {
    var signals_retimed = UNIQUE_SIGNALS_RETIMED["$" + selected_year].length;
  }
  if (!signals_retimed) {
    var signals_retimed = 0;
  }
  var pct_complete = signals_retimed / goal;
  d3.select("#progress-pie").transition(transition).attrTween("d", arcTween(pct_complete * tau));
  d3.select("#" + "pieTextLarge").transition(transition).tween("text", function () {
    var that = this;
    var pct_complete_previous = parseFloat(this.textContent) / 100;
    if (isNaN(pct_complete_previous)) {
      pct_complete_previous = 0;
    }
    var i = d3.interpolate(pct_complete_previous, pct_complete);
    return function (t) {
      that.textContent = formatPctInt(i(t));
    };
  });
  d3.select("#" + "pieTextSmall").transition(transition).tween("text", function () {
    var that = d3.select(this);
    var previous_text = that.text().split(" of ");
    var signals_retimed_previous = previous_text[0];
    var previous_goal = previous_text[1];
    if (isNaN(previous_goal)) {
      previous_goal = 0;
    }
    var i = d3.interpolate(signals_retimed_previous, signals_retimed);
    var q = d3.interpolate(previous_goal, goal);
    return function (t) {
      that.text(Math.round(i(t)) + " of " + Math.round(q(t)));
    };
  });
}
/*Initializes and populates a DataTable with the filtered data set where only
entries corresponding to the selected fiscal year are included. It also sets up
the DataTable configurations such as scroll height, column visibility, sorting,
searching capability, and custom render functions for visualizing specific data
attributes like system names, signal count, status, and travel time changes.
After setup, it removes the default search filter input element and executes the
callback `next`.*/
function populateTable(dataset, next) {
  if ($("#data_table")) {
    $("#data_table").dataTable().fnDestroy();
  }
  var filtered_data = dataset.filter(function (d) {
    return d.scheduled_fy == selected_year;
  });
  table = $("#data_table").DataTable({
    data: filtered_data,
    rowId: "system_id",
    scrollY: table_height,
    scrollCollapse: false,
    paging: false,
    bLengthChange: false,
    autoWidth: false,
    bInfo: false,
    order: [[2, "asc"]],
    oLanguage: {
      sSearch: "Search by Corridor Name"
    },
    drawCallback: function (settings) {},
    columnDefs: [{
      width: "40%",
      targets: 4
    }, {
      width: "10%",
      targets: 1
    }, {
      searchable: false,
      targets: [1, 2, 3, 4]
    }],
    columns: [{
      data: "system_name",
      render: function (data, type, full, meta) {
        return "<a class='tableRow' id='$" + full.system_id + "' >" + data + "</a>";
      }
    }, {
      data: "signal_count"
    }, {
      data: "retime_status",
      render: function (data, type, full, meta) {
        return STATUS_TYPES_READABLE[data];
      }
    }, {
      data: "vol_wavg_tt_pct_change",
      render: function (data, type, full, meta) {
        var travel_time_change = FORMAT_TYPES["travel_time_reduction"](-1 * +data);
        if (full.retime_status != "COMPLETED") {
          return "";
        }
        if (+data < 0) {
          travel_time_change = "+" + travel_time_change;
        }
        return isNaN(data) ? "" : travel_time_change;
      }
    }, {
      data: "system_name",
      render: function (data, type, full, meta) {
        if (full.engineer_note) {
          var engineer_note = full.engineer_note;
          return engineer_note;
        } else {
          return "";
        }
      }
    }]
  });
  d3.select("#data_table_filter").remove();
  next();
}
/*Adds click event listeners to each table row allowing interaction with the data
visualization map; clicking a row removes any existing modal, highlights the
associated layer on the map, fits the map to the layer's bounds, and if modals
are enabled, creates and displays modal content.*/
function createTableListeners() {
  d3.select("#data_table").selectAll("tr").classed("tableRow", true).on("click", function (d) {
    $("#modal-popup-container").remove();
    var system_id = "$" + d3.select(this).attr("id");
    highlightLayer(SYSTEMS_LAYERS[system_id]);
    map.fitBounds(SYSTEMS_LAYERS[system_id].getBounds());
    if (show_modal) {
      var popup_content = getSystemInfo(system_id);
      var modal_content = buildModalContent(popup_content);
      $("#modal-content-container").append("<div id='modal-popup-container'>" + modal_content + "</div>");
      map.setView(SYSTEMS_LAYERS[system_id].getBounds().getCenter(), 13);
      $("#dashModal").modal("toggle");
    }
  });
}
/*Formats time in seconds as a string, prefixing with a minus if the time is
negative or a plus if positive.*/
function formatTravelTime(seconds) {
  formatted_seconds = formatSeconds(new Date(2012, 0, 1, 0, 0, Math.abs(seconds)));
  if (seconds < 0) {
    return "-" + formatted_seconds;
  } else {
    return "+" + formatted_seconds;
  }
}
/*Initializes the map with a predefined center point, disables the zoom control,
and adds two different tile layers (Carto and Stamen) to the map. It finishes by
adding a zoom home control and calling the `next` callback with the newly created
map and the dataset.*/
function makeMap(dataset, next) {
  L.Icon.Default.imagePath = "../components/images/";
  map = new L.Map("map", {
    center: [30.28, -97.735],
    zoom: 12,
    minZoom: 1,
    maxZoom: 20,
    zoomControl: false
  });
  var carto_positron = L.tileLayer("http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subdomains: "abcd",
    maxZoom: 19
  });
  var stamen_toner_lite = L.tileLayer("http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}", {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abcd",
    maxZoom: 20,
    ext: "png"
  }).addTo(map);
  var zoomHome = L.Control.zoomHome();
  zoomHome.addTo(map);
  next(map, dataset);
}
/*Populate the map with circles representing systems for a selected fiscal year,
each circle being a marker bound with a popup containing the intersection and
corridor name. Update the map to show only visible layers relevant to the
selected fiscal year.*/
function populateMap(map, dataset) {
  var zoom = map.getZoom();
  for (var i = 0; i < SOURCE_DATA_SYSTEMS.length; i++) {
    var fy = "$" + SOURCE_DATA_SYSTEMS[i].scheduled_fy;
    if (!SYSTEM_IDS[fy]) {
      SYSTEM_IDS[fy] = [];
    }
    SYSTEM_IDS[fy].push(+SOURCE_DATA_SYSTEMS[i].system_id);
  }
  for (var i = 0; i < dataset.length; i++) {
    var system_layer = "$" + dataset[i].system_id;
    if (!(system_layer in SYSTEMS_LAYERS)) {
      SYSTEMS_LAYERS[system_layer] = new L.featureGroup();
    }
    var system_id = dataset[i].system_id;
    var system_name = dataset[i].system_name;
    var lat = dataset[i].location.latitude;
    var lon = dataset[i].location.longitude;
    var intersection_name = dataset[i].location_name;
    var signal_id = dataset[i].signal_id;
    var marker = L.circle([lat, lon], SCALE_THRESHOLDS["$" + zoom]).bindPopup("<b>" + intersection_name + "</b><br>" + "Corridor: " + system_name);
    marker.addTo(SYSTEMS_LAYERS[system_layer]);
    SIGNAL_MARKERS.push(marker);
  }
  updateVisibleLayers();
}
/*Removes existing visible layers from the map, creates a new layer group for the
selected year, applies default styling to all system layers, adds click event
listeners to highlight a layer on click, fits the map bounds to the new visible
layers after a delay, adds the visible layers to the map, then adjusts the sizes
of all signal markers based on the current map zoom level.*/
function updateVisibleLayers() {
  map.removeLayer(visible_layers);
  visible_layers = new L.featureGroup();
  for (system_id in SYSTEMS_LAYERS) {
    var current_id = +system_id.replace("$", "");
    if (SYSTEM_IDS["$" + selected_year].indexOf(current_id) >= 0) {
      SYSTEMS_LAYERS[system_id].addTo(visible_layers);
    }
  }
  for (system_layer in SYSTEMS_LAYERS) {
    SYSTEMS_LAYERS[system_layer].setStyle(DEFAULT_STYLE);
  }
  visible_layers.eachLayer(function (layer) {
    layer.on("click", function () {
      highlightLayer(this);
    });
  });
  setTimeout(function () {
    map.fitBounds(visible_layers.getBounds());
  }, 500);
  visible_layers.addTo(map);
  setMarkerSizes();
}
/*Sets the radius of each marker in `SIGNAL_MARKERS` based on the current map zoom
level, using predefined thresholds in `SCALE_THRESHOLDS`.*/
function setMarkerSizes() {
  var zoom = map.getZoom();
  for (var i = 0; i < SIGNAL_MARKERS.length; i++) {
    SIGNAL_MARKERS[i].setRadius(SCALE_THRESHOLDS["$" + zoom]);
  }
}
/*Resets all layers to the default style and brings the selected layer to the
front with a highlight style.*/
function highlightLayer(layer) {
  for (system_layer in SYSTEMS_LAYERS) {
    SYSTEMS_LAYERS[system_layer].setStyle(DEFAULT_STYLE);
  }
  layer.setStyle(HIGHLIGHT_STYLE).bringToFront();
}
/*Converts a date to a readable format and checks if the date is today, returning
a string "today" if it is, or the formatted date otherwise.*/
function readableDate(date) {
  var update_date = formatDate(date);
  var today = formatDate(new Date());
  if (update_date == today) {
    return "today";
  } else {
    return update_date;
  }
}
/*Creates an interpolator function for a D3 transition on an arc path,
interpolating the end angle of the arc from its current value to a new value.*/
function arcTween(newAngle) {
  return function (d) {
    var interpolate = d3.interpolate(d.endAngle, newAngle);
    return function (t) {
      d.endAngle = interpolate(t);
      return arc(d);
    };
  };
}
/*Checks if the current device supports touch events or has touch points for touch
interaction.*/
function is_touch_device() {
  return "ontouchstart" in window || navigator.MaxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}
/*Resets the map state to ensure the size of the map container is accurately
accounted for and recenters the map based on the bounds of the currently visible
layers.*/
function resetMap() {
  if (map) {
    map.invalidateSize();
    map.fitBounds(visible_layers.getBounds());
  }
}
/*Expands the map and table containers to full width, transitions the map to fit
the window height, and redraws the table with the new dimensions.*/
function expandMap(table_div_id, map_div_id) {
  d3.select("#" + table_div_id).attr("class", expanded_class + " full_width");
  d3.select("#" + map_div_id).attr("class", expanded_class + " full_width");
  d3.select("#map").transition(t2).style("height", window.innerHeight + "px").on("end", function () {
    map.invalidateSize();
    map.fitBounds(visible_layers.getBounds());
  });
  table.draw();
}
/*Collapse the map view to its original size and update the map and table layout.*/
function collapseMap(table_div_id, map_div_id) {
  var table_div_height = document.getElementById(table_div_id).clientHeight;
  d3.select("#" + table_div_id).attr("class", collapsed_class);
  d3.select("#map").transition(t2).style("height", table_div_height + "px").on("end", function () {
    d3.select("#" + map_div_id).attr("class", collapsed_class);
    map.invalidateSize();
    map.fitBounds(visible_layers.getBounds());
  });
  table.draw();
}
/*Creates and appends header columns (`<th>`) to the table header with the column
names provided in `col_array`, based on the `div_id` of the table. Returns a D3
selection containing the new header columns.*/
function createTableCols(div_id, col_array) {
  var cols = d3.select("#" + div_id).select("thead").append("tr").selectAll("th").data(col_array).enter().append("th").text(function (d) {
    return d;
  });
  return cols;
}
/*Detects browser resize events and adjusts the visibility of table columns, the
location of the map container, and the layout style based on different screen
sizes (breakpoints). On smaller screens (xs, sm, md), certain table columns are
hidden, the map is moved into a modal, and the modal is shown; on larger screens,
the table columns are shown, and if the map was previously placed inside a modal,
it's moved back to its original container. After adjustments, the table columns
are resized to fit the new layout.*/
function resizedw() {
  prev_breakpoint = curr_breakpoint;
  curr_breakpoint = breakpoint();
  if (curr_breakpoint != prev_breakpoint) {
    if (curr_breakpoint === "xs" || curr_breakpoint === "sm" || curr_breakpoint === "md") {
      table.column(1).visible(false);
      table.column(3).visible(false);
      table.column(4).visible(false);
      if (!show_modal) {
        $("#data-row-1").find("#map").appendTo("#modal-content-container");
        show_modal = true;
      }
    } else {
      table.column(1).visible(true);
      table.column(3).visible(true);
      table.column(4).visible(true);
      if (show_modal) {
        $("#modal-content-container").find("#map").appendTo("#data-row-1");
        show_modal = false;
        map.invalidateSize();
      }
    }
  }
  table.columns.adjust();
}
/*Retrieves system information from global SOURCE_DATA_SYSTEMS array based on the
provided system_id after stripping the "$" character. If found, it returns the
system object; otherwise, it returns undefined.*/
function getSystemInfo(system_id) {
  system_id = system_id.replace("$", "");
  for (var i = 0; i < SOURCE_DATA_SYSTEMS.length; i++) if (+SOURCE_DATA_SYSTEMS[i].system_id == +system_id) {
    return SOURCE_DATA_SYSTEMS[i];
  }
  return undefined;
}
/*Creates HTML content for a modal dialog, incorporating system information such
as status, travel time change, and any provided engineer note. If the travel time
change value is negative, it's prefixed with a plus sign to indicate improvement.*/
function buildModalContent(system_info) {
  var status = STATUS_TYPES_READABLE[system_info.retime_status];
  var system_name = system_info.system_name;
  var travel_time_change = "";
  if (status == "Completed") {
    travel_time_change = FORMAT_TYPES["travel_time_reduction"](-1 * +system_info.vol_wavg_tt_pct_change);
    if (+travel_time_change < 0) {
      travel_time_change = "+" + travel_time_change;
    }
  }
  var engineer_note = "";
  if (system_info.engineer_note) {
    var engineer_note = system_info.engineer_note;
  }
  return "<h5>" + system_name + "</h5>" + "<b>Status: <b>" + status + "<br>" + "<b>Travel Time Change: <b>" + travel_time_change + "<br>" + "<b>Engineer Note: <b>" + engineer_note;
}