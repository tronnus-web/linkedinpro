function debugChartInitialization() {
  console.log("=== Chart Debug Information ===");
  
  // Check for the canvas element
  const canvas = document.getElementById('connections-chart');
  console.log("Canvas element exists:", !!canvas);
  
  if (canvas) {
    console.log("Canvas dimensions:", {
      width: canvas.width,
      height: canvas.height,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      style: canvas.getAttribute('style')
    });
  } else {
    console.error("Canvas element with ID 'connections-chart' not found!");
    
    // Look for other canvas elements
    const allCanvases = document.querySelectorAll('canvas');
    console.log(`Found ${allCanvases.length} canvas elements on the page:`);
    allCanvases.forEach((c, i) => {
      console.log(`Canvas ${i}: id=${c.id}, class=${c.className}`);
    });
  }
  
  // Check if Chart.js is loaded
  console.log("Chart global object exists:", typeof Chart !== 'undefined');
  
  // Check the chart container
  const container = document.querySelector('.chart-container');
  console.log("Chart container exists:", !!container);
  if (container) {
    console.log("Chart container dimensions:", {
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight,
      style: container.getAttribute('style')
    });
    console.log("Chart container HTML:", container.innerHTML);
  }

  // Check if we have any data to display
  chrome.runtime.sendMessage({ action: 'getAnalytics' }, function(response) {
    console.log("Analytics data received:", response);
    if (response && response.analytics) {
      console.log("Total sent:", response.analytics.totalSent);
      console.log("connectionsByDate:", response.analytics.connectionsByDate);
    }
  });
}
// Analytics Charting Functions
function initializeCharts() {
  console.log("initializeCharts called");
  
  // Only initialize if on analytics tab
  if (!document.getElementById('connections-chart')) {
    console.error("connections-chart element not found");
    return;
  }
  
  console.log("Chart element found, proceeding with initialization");
  
  // Run debug checks
  debugChartInitialization();
  
  // Get chart labels (last 7 days)
  const labels = getLast7DaysLabels();
  console.log("Chart labels:", labels);
  
  // Initialize with empty data - will be populated later
  const connectionData = {
    sent: [0, 0, 0, 0, 0, 0, 0],
    accepted: [0, 0, 0, 0, 0, 0, 0]
  };
  
  // Request real data from background script
  chrome.runtime.sendMessage({ action: 'getAnalytics' }, function(response) {
    console.log("Received analytics response:", response);
    if (response && response.analytics) {
      // Process the real data and update charts
      updateCharts(response.analytics);
    }
  });
    
    // Create chart
    const connectionsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Connections Sent',
            data: connectionData.sent,
            backgroundColor: '#0077B5',
            borderColor: '#0077B5',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 10,
          },
          {
            label: 'Connections Accepted',
            data: connectionData.accepted,
            backgroundColor: '#00A0DC',
            borderColor: '#00A0DC',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 10,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(200, 200, 200, 0.1)',
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(50, 50, 50, 0.95)',
            padding: 10,
            cornerRadius: 4,
            titleFont: {
              size: 12
            },
            bodyFont: {
              size: 12
            }
          }
        }
      }
    });
    
    // Save chart instance for later updates
    window.connectionsChart = connectionsChart;
    
    // Initialize template performance chart
    initializeTemplatePerformanceChart();
    
    // Initialize connection rate chart
    initializeConnectionRateChart();
  }
  
  // Get last 7 days as labels
  function getLast7DaysLabels() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(formatDate(date));
    }
    return days;
  }
  
  // Format date as "MMM DD"
  function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
  
  // Initialize template performance chart
  function initializeTemplatePerformanceChart() {
    // Only initialize if element exists
    const element = document.getElementById('template-performance-chart');
    if (!element) return;
    
    const ctx = element.getContext('2d');
    
    // Sample data - would be replaced with real data in production
    const data = {
      labels: ['Default', 'Recruiter', 'Sales', 'Networking'],
      acceptanceRates: [55.8, 67.6, 50.0, 100.0]
    };
    
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(0, 119, 181, 0.8)');
    gradientFill.addColorStop(1, 'rgba(0, 119, 181, 0.2)');
    
    const templateChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Acceptance Rate (%)',
          data: data.acceptanceRates,
          backgroundColor: gradientFill,
          borderColor: '#0077B5',
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 30
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(200, 200, 200, 0.1)',
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              },
              font: {
                size: 11
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Acceptance Rate: ${context.raw}%`;
              }
            }
          }
        }
      }
    });
    
    // Save chart instance for later updates
    window.templateChart = templateChart;
  }
  
  // Initialize connection rate chart
  function initializeConnectionRateChart() {
    // Only initialize if element exists
    const element = document.getElementById('connection-rate-chart');
    if (!element) return;
    
    const ctx = element.getContext('2d');
    
    // Sample data - would be replaced with real data
    const data = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      connectionRate: [45, 53, 58, 62, 60, 65]
    };
    
    const connectionRateChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Connection Rate (%)',
          data: data.connectionRate,
          fill: {
            target: 'origin',
            above: 'rgba(0, 119, 181, 0.1)'
          },
          borderColor: '#0077B5',
          borderWidth: 2,
          pointBackgroundColor: '#0077B5',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(200, 200, 200, 0.1)',
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              },
              font: {
                size: 11
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Acceptance Rate: ${context.raw}%`;
              }
            }
          }
        }
      }
    });
    
    // Save chart instance for later updates
    window.connectionRateChart = connectionRateChart;
  }
  
  // Update charts with new data
  function updateCharts(analyticsData) {
    if (!analyticsData) return;
    
    // Update connections chart if it exists
    if (window.connectionsChart) {
      const last7Days = getLast7DaysLabels();
      const sent = [];
      const accepted = [];
      
      // Process data for each day
      last7Days.forEach(day => {
        const dayData = analyticsData.connectionsByDate[day] || { sent: 0, accepted: 0 };
        sent.push(dayData.sent || 0);
        accepted.push(dayData.accepted || 0);
      });
      
      // Update chart data
      window.connectionsChart.data.labels = last7Days;
      window.connectionsChart.data.datasets[0].data = sent;
      window.connectionsChart.data.datasets[1].data = accepted;
      window.connectionsChart.update();
    }
    
    // Update template performance chart if it exists
    if (window.templateChart && analyticsData.connectionsByTemplate) {
      const templateIds = Object.keys(analyticsData.connectionsByTemplate);
      const acceptanceRates = templateIds.map(id => {
        const templateData = analyticsData.connectionsByTemplate[id];
        if (templateData.sent > 0) {
          return ((templateData.accepted / templateData.sent) * 100).toFixed(1);
        }
        return 0;
      });
      
      // Update chart data
      window.templateChart.data.labels = templateIds;
      window.templateChart.data.datasets[0].data = acceptanceRates;
      window.templateChart.update();
    }
    
    // Update connection rate chart if applicable
    if (window.connectionRateChart) {
      // This would be implemented with real weekly data in production
      window.connectionRateChart.update();
    }
  }
  
  // Build calendar heatmap
  function buildCalendarHeatmap(analyticsData) {
    const heatmapContainer = document.querySelector('.calendar-heatmap');
    if (!heatmapContainer || !analyticsData) return;
    
    // Clear existing heatmap
    heatmapContainer.innerHTML = '';
    
    // Get dates for last 90 days
    const dates = [];
    for (let i = 90; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push({
        date: date,
        formatted: formatDate(date),
        isoDate: date.toISOString().split('T')[0]
      });
    }
    
    // Create heatmap cells
    dates.forEach(dateInfo => {
      const day = document.createElement('div');
      day.className = 'heatmap-day';
      
      // Check if we have data for this date
      if (analyticsData.connectionsByDate && analyticsData.connectionsByDate[dateInfo.isoDate]) {
        const dayData = analyticsData.connectionsByDate[dateInfo.isoDate];
        const sentCount = dayData.sent || 0;
        
        // Determine intensity level (0-4)
        let level = 0;
        if (sentCount > 0 && sentCount <= 5) level = 1;
        else if (sentCount > 5 && sentCount <= 10) level = 2;
        else if (sentCount > 10 && sentCount <= 20) level = 3;
        else if (sentCount > 20) level = 4;
        
        day.classList.add(`level-${level}`);
        
        // Add tooltip data
        day.setAttribute('data-date', dateInfo.formatted);
        day.setAttribute('data-sent', sentCount);
        day.setAttribute('data-accepted', dayData.accepted || 0);
        
        // Add tooltip event listener
        day.addEventListener('mouseenter', showHeatmapTooltip);
        day.addEventListener('mouseleave', hideHeatmapTooltip);
      } else {
        day.classList.add('level-0');
      }
      
      heatmapContainer.appendChild(day);
    });
  }
  
  // Show tooltip for heatmap day
  function showHeatmapTooltip(event) {
    const day = event.target;
    const date = day.getAttribute('data-date');
    const sent = day.getAttribute('data-sent');
    const accepted = day.getAttribute('data-accepted');
    
    // Create tooltip if it doesn't exist
    let tooltip = document.getElementById('heatmap-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'heatmap-tooltip';
      tooltip.className = 'heatmap-tooltip';
      document.body.appendChild(tooltip);
    }
    
    // Set tooltip content
    tooltip.innerHTML = `
      <div class="tooltip-date">${date}</div>
      <div class="tooltip-stat">Sent: ${sent}</div>
      <div class="tooltip-stat">Accepted: ${accepted}</div>
      <div class="tooltip-stat">Rate: ${sent > 0 ? ((accepted / sent) * 100).toFixed(1) + '%' : '0%'}</div>
    `;
    
    // Position tooltip near the day
    const rect = day.getBoundingClientRect();
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.display = 'block';
  }
  
  // Hide heatmap tooltip
  function hideHeatmapTooltip() {
    const tooltip = document.getElementById('heatmap-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
  
  // Generate analytics report
  function generateAnalyticsReport(analyticsData) {
    if (!analyticsData) return '';
    
    // Calculate overall performance
    const totalSent = analyticsData.totalSent || 0;
    const totalAccepted = analyticsData.successful || 0;
    const overallRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;
    
    // Get best performing template
    let bestTemplate = { id: 'none', rate: 0 };
    if (analyticsData.connectionsByTemplate) {
      Object.entries(analyticsData.connectionsByTemplate).forEach(([id, data]) => {
        if (data.sent >= 10) { // Minimum 10 sent to be meaningful
          const rate = data.sent > 0 ? ((data.accepted / data.sent) * 100) : 0;
          if (rate > bestTemplate.rate) {
            bestTemplate = { id, rate };
          }
        }
      });
    }
    
    // Format dates
    const startDate = analyticsData.startTime ? new Date(analyticsData.startTime).toLocaleDateString() : 'N/A';
    const endDate = analyticsData.endTime ? new Date(analyticsData.endTime).toLocaleDateString() : 'N/A';
    
    // Build report
    return `
      # LinkedIn Connection Pro - Analytics Report
      
      ## Performance Summary
      - **Period**: ${startDate} to ${endDate}
      - **Total Connections Sent**: ${totalSent}
      - **Connections Accepted**: ${totalAccepted}
      - **Overall Acceptance Rate**: ${overallRate}%
      
      ## Template Performance
      - **Best Performing Template**: ${bestTemplate.id !== 'none' ? bestTemplate.id : 'N/A'} (${bestTemplate.rate.toFixed(1)}% acceptance)
      
      ## Daily Activity
      ${Object.entries(analyticsData.connectionsByDate || {})
        .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
        .slice(0, 10)
        .map(([date, data]) => {
          const rate = data.sent > 0 ? ((data.accepted / data.sent) * 100).toFixed(1) : 0;
          return `- **${new Date(date).toLocaleDateString()}**: Sent ${data.sent || 0}, Accepted ${data.accepted || 0} (${rate}%)`;
        })
        .join('\n')
      }
      
      ## Recommendations
      ${overallRate < 30 ? '- Consider improving your connection message personalization' : ''}
      ${totalSent < 50 ? '- Increase your outreach volume for better networking results' : ''}
      ${bestTemplate.id !== 'none' ? `- The "${bestTemplate.id}" template performs best, consider using it more` : ''}
      
      Report generated on ${new Date().toLocaleString()}
    `;
  }
  
  // Export analytics to CSV
  function exportAnalyticsToCSV(analyticsData) {
    if (!analyticsData) return '';
    
    // Headers
    const headers = ['Date', 'Connections Sent', 'Connections Accepted', 'Acceptance Rate (%)'];
    
    // Rows
    const rows = [];
    
    // Add daily data
    if (analyticsData.connectionsByDate) {
      Object.entries(analyticsData.connectionsByDate)
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
        .forEach(([date, data]) => {
          const sent = data.sent || 0;
          const accepted = data.accepted || 0;
          const rate = sent > 0 ? ((accepted / sent) * 100).toFixed(1) : '0.0';
          
          rows.push([date, sent, accepted, rate]);
        });
    }
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
  }
  
  // Download analytics as CSV
  function downloadAnalyticsCSV(analyticsData) {
    const csvContent = exportAnalyticsToCSV(analyticsData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `linkedin-connections-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // Update analytics metrics on the page with real data
function updateAnalyticsMetrics(analytics) {
    // Update connection count metrics
    const sentElement = document.querySelector('.metric-card:nth-child(1) .metric-value');
    const acceptedElement = document.querySelector('.metric-card:nth-child(2) .metric-value');
    const rateElement = document.querySelector('.metric-card:nth-child(3) .metric-value');
    
    if (sentElement) sentElement.textContent = analytics.totalSent || 0;
    if (acceptedElement) acceptedElement.textContent = analytics.successful || 0;
    
    // Calculate and update acceptance rate
    if (rateElement) {
      const rate = analytics.totalSent > 0 
        ? ((analytics.successful / analytics.totalSent) * 100).toFixed(1) 
        : "0";
      rateElement.textContent = rate + "%";
    }
    
    // Update template performance table if it exists
    const tableBody = document.querySelector('.data-table tbody');
    if (tableBody && analytics.connectionsByTemplate) {
      tableBody.innerHTML = ''; // Clear existing rows
      
      // Create rows for each template
      Object.entries(analytics.connectionsByTemplate).forEach(([templateId, data]) => {
        const row = document.createElement('tr');
        const rate = data.sent > 0 ? ((data.accepted / data.sent) * 100).toFixed(1) : "0.0";
        
        row.innerHTML = `
          <td>${templateId}</td>
          <td>${data.sent || 0}</td>
          <td>${data.accepted || 0}</td>
          <td>${rate}%</td>
        `;
        
        tableBody.appendChild(row);
      });
    }
  }