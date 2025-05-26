import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Input, Typography, Space, Card, Spin, Radio } from 'antd';
import { RedoOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

// Import missing sub-components explicitly
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;
const { Text } = Typography;
const { Group: RadioGroup, Button: RadioButton } = Radio;

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Register Chart.js components and the datalabels plugin
ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels, BarElement, CategoryScale, LinearScale);

const ExpenseEntry = () => {
  const [closingEntries, setClosingEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);

  const expenseCategories = [
    'MAINTENANCE',
    'TRANSPORT',
    'FUEL',
    'PACKING',
    'STAFF WELFARE',
    'ADVERTISEMENT',
    'ADVANCE',
    'OTHERS',
  ];

  useEffect(() => {
    fetchBranches();
    fetchClosingEntries();
  }, []);

  useEffect(() => {
    let filtered = [...closingEntries];

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((entry) => {
        const branchMatch = entry.branchId?.name?.toLowerCase().includes(searchLower);
        const expenseMatch = entry.expenseDetails.some((detail) => {
          const recipientMatch = detail.recipient?.toLowerCase().includes(searchLower);
          const amountMatch = detail.amount?.toString().includes(searchLower);
          const reasonMatch = detail.reason?.toLowerCase().includes(searchLower);
          return recipientMatch || amountMatch || reasonMatch;
        });
        return branchMatch || expenseMatch;
      });
    }

    if (branchFilter) {
      filtered = filtered.filter((entry) => entry.branchId?._id === branchFilter);
    }

    if (dateRangeFilter && dateRangeFilter.length === 2) {
      const startDate = dayjs(dateRangeFilter[0]).startOf('day');
      const endDate = dayjs(dateRangeFilter[1]).endOf('day');
      filtered = filtered.filter((entry) => {
        const entryDate = dayjs(entry.date);
        return entryDate.isValid() && entryDate.isBetween(startDate, endDate, null, '[]');
      });
    }

    if (categoryFilter) {
      filtered = filtered.filter((entry) =>
        entry.expenseDetails.some((detail) => detail.reason === categoryFilter)
      );
    }

    setFilteredEntries(filtered);
  }, [closingEntries, searchText, branchFilter, dateRangeFilter, categoryFilter]);

  const fetchBranches = async () => {
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/branches/public', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setBranches(result);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchClosingEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/closing-entries', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setClosingEntries(result);
        setFilteredEntries(result);
      }
    } catch (err) {
      console.error('Error fetching closing entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchText('');
    setBranchFilter(null);
    setDateRangeFilter(null);
    setCategoryFilter(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const branchChartData = useMemo(() => {
    const branchTotals = {};
    let totalExpenses = 0;

    filteredEntries.forEach((entry) => {
      const branchName = entry.branchId?.name || 'Unknown Branch';
      const expense = entry.expenses || 0;
      branchTotals[branchName] = (branchTotals[branchName] || 0) + expense;
      totalExpenses += expense;
    });

    const labels = [];
    const data = [];
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    Object.entries(branchTotals).forEach(([branchName, amount]) => {
      if (amount > 0) {
        labels.push(branchName);
        data.push(amount);
      }
    });

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredEntries]);

  const categoryChartData = useMemo(() => {
    const categoryTotals = {};
    let totalCategoryExpenses = 0;

    filteredEntries.forEach((entry) => {
      entry.expenseDetails.forEach((detail) => {
        const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
        const amount = detail.amount || 0;
        categoryTotals[reason] = (categoryTotals[reason] || 0) + amount;
        totalCategoryExpenses += amount;
      });
    });

    const labels = [];
    const data = [];
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    const allCategories = [...expenseCategories];
    allCategories.forEach((category) => {
      const amount = categoryTotals[category] || 0;
      if (amount > 0) {
        labels.push(category);
        data.push(amount);
      }
    });

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredEntries]);

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: {
          color: '#000',
          font: {
            weight: 'bold',
            size: 14,
          },
          boxWidth: 20,
          padding: 10,
          generateLabels: (chart) => {
            const { data } = chart;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                const value = data.datasets[0].data[i];
                const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                return {
                  text: `${label}: ₹${value} (${percentage}%)`,
                  fillStyle: style.backgroundColor,
                  strokeStyle: style.borderColor,
                  lineWidth: style.borderWidth,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#fff',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return [`${label}: ₹${value}`, `(${percentage}%)`];
          },
        },
      },
      datalabels: {
        display: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 0.5;
        },
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 3,
        padding: 6,
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
          return `₹${value} (${percentage}%)`;
        },
        align: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center';
        },
        anchor: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center';
        },
        offset: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? -10 : 0;
        },
        font: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          let fontSize;
          if (percentage < 1) {
            fontSize = 10;
          } else if (percentage <= 5) {
            fontSize = 14;
          } else {
            fontSize = 16;
          }
          return {
            weight: 'bold',
            size: fontSize,
          };
        },
        textAlign: 'center',
      },
    },
    maintainAspectRatio: false,
  };

  const branchChartOptions = {
    ...chartOptions,
  };

  const categoryChartOptions = {
    ...chartOptions,
  };

  const barChartData = useMemo(() => {
    const currentDate = dayjs('2025-05-23');
    const targetMonth = currentDate.month();
    const targetYear = currentDate.year();
    const daysInMonth = currentDate.daysInMonth();
  
    // Create labels for all days in the month
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  
    // Initialize arrays for all days in the month
    const dailyExpenses = Array(daysInMonth).fill(0);
    const dailyCategoryExpenses = Array(daysInMonth).fill().map(() => ({}));
  
    const dateEntries = filteredEntries.map(entry => ({
      date: dayjs(entry.date),
      entry,
    }));
  
    dateEntries.forEach(({ date, entry }) => {
      if (date.month() === targetMonth && date.year() === targetYear) {
        const dayIndex = date.date() - 1;
        dailyExpenses[dayIndex] += entry.expenses || 0;
  
        entry.expenseDetails.forEach((detail) => {
          const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
          const amount = detail.amount || 0;
          dailyCategoryExpenses[dayIndex][reason] = (dailyCategoryExpenses[dayIndex][reason] || 0) + amount;
        });
      }
    });
  
    const maxExpense = Math.max(...dailyExpenses, 1);
  
    return {
      labels,
      datasets: [
        {
          label: 'Daily Expenses',
          data: dailyExpenses,
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1,
        },
      ],
      maxExpense,
      dailyCategoryExpenses,
    };
  }, [filteredEntries]);
  
  const barChartOptions = {
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            weight: 'bold',
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dayIndex = context.dataIndex;
            const totalAmount = context.raw || 0;
            const categories = barChartData.dailyCategoryExpenses[dayIndex];
  
            const tooltipLines = [`Amount: ₹${totalAmount}`];
  
            expenseCategories.forEach((category) => {
              const amount = categories[category] || 0;
              if (amount > 0) {
                tooltipLines.push(`${category}: ₹${amount}`);
              }
            });
  
            return tooltipLines;
          },
        },
      },
      datalabels: {
        display: true,
        color: '#FFFFFF', // White text
        backgroundColor: '#000000', // Black background
        borderRadius: 3, // Rounded corners for the label background
        padding: 4, // Padding inside the label
        formatter: (value) => (value > 0 ? `₹${value}` : ''), // Only show label if value is greater than 0
        anchor: 'end', // Position at the top of the bar
        align: 'top', // Align label above the bar
        font: {
          weight: 'bold',
          size: 12,
        },
        textAlign: 'center',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            weight: 'bold',
          },
        },
        ticks: {
          autoSkip: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount (₹)',
          font: {
            weight: 'bold',
          },
        },
        beginAtZero: true,
        max: Math.ceil(barChartData.maxExpense * 1.1),
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  const columns = [
    {
      title: 'Serial No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 50,
    },
    {
      title: 'Branch',
      dataIndex: ['branchId', 'name'],
      key: 'branch',
      render: (value) => value || 'N/A',
      width: 80,
    },
    {
      title: 'Total Expense',
      dataIndex: 'expenses',
      key: 'totalExpense',
      render: (value) => `₹${value || 0}`,
      width: 80,
    },
    {
      title: 'Maintenance',
      key: 'maintenance',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'MAINTENANCE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Transport',
      key: 'transport',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'TRANSPORT');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Fuel',
      key: 'fuel',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'FUEL');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Packing',
      key: 'packing',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'PACKING');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Staff Welfare',
      key: 'staffWelfare',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'STAFF WELFARE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Advertisement',
      key: 'advertisement',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'ADVERTISEMENT');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Advance',
      key: 'advance',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'ADVANCE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Others',
      key: 'others',
      render: (record) => {
        const expenses = record.expenseDetails.filter(
          (d) => !expenseCategories.includes(d.reason) || d.reason === 'OTHERS'
        );
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              <div>
                <strong>₹{exp.amount || 0}</strong> {exp.recipient || 'N/A'}
              </div>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 100,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (date) => dayjs(date).format('DD-MM-YYYY'),
      width: 80,
    },
  ];

  return (
    <div
      style={{
        padding: '40px 20px',
        background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <style>
        {`
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .filter-section, .bar-chart-section {
              display: none;
            }
            .table-section, .charts-section {
              width: 100%;
              margin: 0;
              box-shadow: none;
              border: none;
              page-break-inside: avoid;
            }
            .ant-table {
              font-size: 10px;
            }
            .ant-table th, .ant-table td {
              padding: 4px !important;
            }
            .charts-section {
              display: flex;
              justify-content: center;
              page-break-before: auto;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          }
          .circle-radio .ant-radio-button-wrapper {
            border-radius: 50%;
            width: 120px;
            height: 40px;
            line-height: 40px;
            text-align: center;
            border: 1px solid #d9d9d9;
            margin-right: 10px;
            transition: all 0.3s;
          }
          .circle-radio .ant-radio-button-wrapper-checked {
            background-color: #1890ff;
            color: #fff;
            border-color: #1890ff;
          }
          .circle-radio .ant-radio-button-wrapper:hover {
            background-color: #e6f7ff;
            border-color: #1890ff;
          }
          .charts-section {
            display: flex;
            flex-direction: row;
            justify-content: center;
            width: 100%;
            max-width: 1600px;
            gap: 20px;
            margin-bottom: 40px;
          }
          .chart-container.doughnut {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 50%;
            max-width: 800px;
            height: 60vh;
            min-height: 450px;
            min-width: 450px;
          }
          .doughnut-card {
            width: 100%;
            max-width: 800px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #fff;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .chart-container.bar {
            width: 100%;
            max-width: 1600px;
            height: 50vh;
            min-height: 400px;
            min-width: 900px;
          }
          .bar-card {
            width: 100%;
            max-width: 1600px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #fff;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .chart-legend-bottom-left {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 0;
          }
          .chart-legend-bottom-left .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          }
          .chart-legend-bottom-left .legend-item span {
            margin-right: 8px;
          }
          .ant-table td.date-column {
            white-space: nowrap;
          }
          @media (max-width: 1200px) {
            .charts-section {
              flex-direction: column;
              align-items: center;
            }
            .chart-container.doughnut {
              width: 95vw;
              max-width: 600px;
              min-width: 500px;
              height: 55vh;
              min-height: 400px;
            }
            .chart-container.bar {
              width: 95vw;
              max-width: 1200px;
              min-width: 700px;
              height: 45vh;
              min-height: 350px;
            }
            .doughnut-card, .bar-card {
              max-width: 100%;
            }
          }
          @media (max-width: 768px) {
            .chart-container.doughnut {
              width: 98vw;
              max-width: 500px;
              min-width: 400px;
              height: 50vh;
              min-height: 350px;
            }
            .chart-container.bar {
              width: 98vw;
              max-width: 1000px;
              min-width: 400px;
              height: 40vh;
              min-height: 300px;
            }
          }
          @media (max-width: 480px) {
            .chart-container.doughnut {
              width: 98vw;
              max-width: 400px;
              min-width: 350px;
              height: 45vh;
              min-height: 300px;
            }
            .chart-container.bar {
              width: 98vw;
              max-width: 850px;
              min-width: 300px;
              height: 35vh;
              min-height: 250px;
            }
          }
          @media print {
            .chart-container.doughnut {
              width: 40%;
              max-width: 400px;
              height: 40vh;
              min-height: 300px;
              min-width: 350px;
            }
            .chart-container.bar {
              width: 100%;
              max-width: 1200px;
              height: 40vh;
              min-height: 300px;
              min-width: 700px;
            }
          }
        `}
      </style>
      <div style={{ maxWidth: '1600px', width: '100%' }}>
        <Card
          className="filter-section"
          style={{
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            background: '#fafafa',
            marginBottom: '20px',
            border: '1px solid #e8e8e8',
          }}
        >
          <Space
            direction="horizontal"
            wrap
            style={{
              width: '100%',
              padding: '15px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Space wrap>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Search
                </Text>
                <Search
                  placeholder="Search by branch, recipient, amount, or reason"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '200px' }}
                  allowClear
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Branch Filter
                </Text>
                <Select
                  placeholder="All Branches"
                  value={branchFilter}
                  onChange={(value) => setBranchFilter(value)}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value={null}>All Branches</Option>
                  {branches.map((branch) => (
                    <Option key={branch._id} value={branch._id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Date Range
                </Text>
                <RangePicker
                  value={dateRangeFilter}
                  onChange={(dates) => setDateRangeFilter(dates)}
                  format="YYYY-MM-DD"
                  style={{ width: '250px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Expense Category
                </Text>
                <Select
                  placeholder="All Categories"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value)}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value={null}>All Categories</Option>
                  <Option value="MAINTENANCE">Maintenance</Option>
                  <Option value="TRANSPORT">Transport</Option>
                  <Option value="FUEL">Fuel</Option>
                  <Option value="PACKING">Packing</Option>
                  <Option value="STAFF WELFARE">Staff Welfare</Option>
                  <Option value="ADVERTISEMENT">Advertisement</Option>
                  <Option value="ADVANCE">Advance</Option>
                  <Option value="OTHERS">Others</Option>
                </Select>
              </div>
            </Space>

            <Space>
              <Button type="default" icon={<RedoOutlined />} onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="default"
                icon={<FileTextOutlined />}
                href="/dealers/closing-entry/list"
              >
                Closing Entry List
              </Button>
              <Button type="default" icon={<PrinterOutlined />} onClick={handlePrint}>
                Print
              </Button>
            </Space>
          </Space>
        </Card>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Card
              className="table-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              <Table
                columns={columns}
                dataSource={filteredEntries}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                bordered
                rowClassName={(record, index) => (index === filteredEntries.length - 1 ? 'last-row' : '')}
              />
            </Card>

            <div className="charts-section">
              {filteredEntries.length > 0 ? (
                <>
                  <Card className="doughnut-card">
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                        Branch-Wise Expenses
                      </Text>
                      <div className="chart-container doughnut">
                        <Doughnut data={branchChartData} options={branchChartOptions} />
                      </div>
                    </div>
                  </Card>
                  <Card className="doughnut-card">
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                        Category-Wise Expenses
                      </Text>
                      <div className="chart-container doughnut">
                        <Doughnut data={categoryChartData} options={categoryChartOptions} />
                      </div>
                    </div>
                  </Card>
                </>
              ) : (
                <Card
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    background: '#fff',
                    marginBottom: '20px',
                    width: '100%',
                  }}
                >
                  <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                    No data to display
                  </Text>
                </Card>
              )}
            </div>

            <Card
              className="bar-chart-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              {filteredEntries.length > 0 ? (
                <div style={{ textAlign: 'center' }}>
                  <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                    Date-Wise Expenses (May 2025)
                  </Text>
                  <div className="chart-container bar">
                    <Bar data={barChartData} options={barChartOptions} />
                  </div>
                </div>
              ) : (
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseEntry;