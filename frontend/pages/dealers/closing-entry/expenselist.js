
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Input, Typography, Space, Card, Spin, Switch, Tooltip, Modal } from 'antd';
import { RedoOutlined, PrinterOutlined } from '@ant-design/icons';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;
const { Text } = Typography;

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

ChartJS.register(ArcElement, ChartTooltip, Legend, ChartDataLabels, BarElement, CategoryScale, LinearScale);

const ExpenseEntry = () => {
  const [closingEntries, setClosingEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState([dayjs(), dayjs()]);
  const [dateFilterType, setDateFilterType] = useState('today');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showSummaryTable, setShowSummaryTable] = useState(true);

  const expenseCategories = [
    'MAINTENANCE',
    'TRANSPORT',
    'FUEL',
    'PACKING',
    'STAFF WELFARE',
    'ADVERTISEMENT',
    'ADVANCE',
    'OTHERS',
    'OC PRODUCTS',
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
    setDateRangeFilter([dayjs(), dayjs()]);
    setDateFilterType('today');
    setCategoryFilter(null);
    setShowSummaryTable(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDateFilterChange = (value) => {
    setDateFilterType(value);
    const today = dayjs();
    switch (value) {
      case 'today':
        setDateRangeFilter([today, today]);
        break;
      case 'yesterday':
        setDateRangeFilter([today.subtract(1, 'day'), today.subtract(1, 'day')]);
        break;
      case 'last7days':
        setDateRangeFilter([today.subtract(6, 'day'), today]);
        break;
      case 'last30days':
        setDateRangeFilter([today.subtract(29, 'day'), today]);
        break;
      case 'custom':
        setDateRangeFilter(null);
        break;
      default:
        break;
    }
  };

  const handleViewExpenses = (record, branchName, date) => {
    const expenseDetails = record.expenseDetails || [];
    const title = `Expense Details for ${branchName}${date ? ` on ${dayjs(date).format('DD-MM-YYYY')}` : ''}`;
    Modal.info({
      title,
      content: (
        <div>
          {expenseDetails.length > 0 ? (
            <ul>
              {expenseDetails.map((detail, index) => (
                <li key={index}>
                  <strong>₹{formatNumber(detail.amount || 0)}</strong> - {detail.reason} ({detail.recipient || 'N/A'})
                </li>
              ))}
            </ul>
          ) : (
            <p>No expense details available.</p>
          )}
        </div>
      ),
      width: 600,
      onOk() {},
    });
  };

  const formatNumber = (value) => {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  };

  const categoryTotals = useMemo(() => {
    const data = expenseCategories.map((category) => {
      const row = {
        category,
        branchAmounts: {},
        branchReasons: {},
        total: 0,
        createdAt: null,
      };

      filteredEntries.forEach((entry) => {
        const branchId = entry.branchId?._id || 'unknown';
        entry.expenseDetails.forEach((detail) => {
          const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
          if (reason === category) {
            row.branchAmounts[branchId] = (row.branchAmounts[branchId] || 0) + (detail.amount || 0);
            row.branchReasons[branchId] = row.branchReasons[branchId]
              ? [...row.branchReasons[branchId], detail.reason]
              : [detail.reason];
            row.total += detail.amount || 0;
            if (!row.createdAt || dayjs(entry.createdAt).isAfter(dayjs(row.createdAt))) {
              row.createdAt = entry.createdAt;
            }
          }
        });
      });

      branches.forEach((branch) => {
        const branchId = branch._id;
        row.branchAmounts[branchId] = row.branchAmounts[branchId] || 0;
        row.branchReasons[branchId] = row.branchReasons[branchId] || [];
      });

      return row;
    });

    return data;
  }, [filteredEntries, branches]);

  const summaryColumns = [
    {
      title: 'S.No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 60,
      fixed: 'left',
    },
    {
      title: 'Expense Name',
      dataIndex: 'category',
      key: 'category',
      render: (value) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      width: 150,
      fixed: 'left',
      onCell: () => ({
        style: { backgroundColor: 'rgb(220, 248, 199)' },
      }),
    },
    ...branches.map((branch) => ({
      title: branch.name,
      key: branch._id,
      render: (record) => {
        const amount = record.branchAmounts[branch._id] || 0;
        const reasons = record.branchReasons[branch._id] || [];
        return amount > 0 ? (
          <Tooltip title={reasons.join(', ') || 'No reason'}>
            <Text strong>₹{formatNumber(amount)}</Text>
          </Tooltip>
        ) : (
          '-'
        );
      },
      width: 150,
      onCell: () => ({
        style: { backgroundColor: 'lightskyblue' },
      }),
    })),
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (value, record) => value > 0 ? (
        <Tooltip title={record.reasons ? record.reasons.join(', ') : 'No reason'}>
          <Text strong>₹{formatNumber(value)}</Text>
        </Tooltip>
      ) : '-',
      width: 150,
      onCell: (record) => ({
        style: { backgroundColor: '#ff6384' },
        title: record.createdAt ? `Created At: ${dayjs(record.createdAt).format('DD/MM/YYYY HH:mm:ss')}` : 'N/A',
      }),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => value ? dayjs(value).format('D/M/YY') : 'N/A',
      width: 100,
      onCell: (record) => ({
        style: { backgroundColor: 'rgb(220, 248, 199)' },
        title: record.createdAt ? `Created At: ${dayjs(record.createdAt).format('DD/MM/YYYY HH:mm:ss')}` : 'N/A',
      }),
    },
  ];

  const detailedColumns = [
    {
      title: 'S.No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 60,
    },
    {
      title: 'Branch',
      dataIndex: ['branchId', 'name'],
      key: 'branch',
      render: (value) => value || 'N/A',
      width: 150,
      onCell: () => ({
        style: { backgroundColor: 'lightskyblue' },
      }),
    },
    {
      title: 'Total Expense',
      dataIndex: 'expenses',
      key: 'totalExpense',
      render: (value, record) => (
        <Tooltip title={record.expenseDetails.map((d) => d.reason).join(', ')}>
          <Text
            strong
            style={{ cursor: value > 0 ? 'pointer' : 'default' }}
            onClick={() => value > 0 && handleViewExpenses(record, record.branchId?.name || 'Unknown Branch', record.date)}
          >
            ₹{formatNumber(value || 0)}
          </Text>
        </Tooltip>
      ),
      width: 150,
      onCell: () => ({
        style: { backgroundColor: '#ff6384' },
      }),
    },
    ...expenseCategories.map((category) => ({
      title: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      key: category.toLowerCase(),
      render: (record) => {
        const expenses = record.expenseDetails.filter(
          (d) => (category === 'OTHERS' ? !expenseCategories.includes(d.reason) || d.reason === 'OTHERS' : d.reason === category)
        );
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <Tooltip title={exp.reason} key={index}>
              <div>
                <Text strong>₹{formatNumber(exp.amount || 0)}</Text> {exp.recipient || 'N/A'}
              </div>
            </Tooltip>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
      onCell: (record) => ({
        style: { backgroundColor: 'rgb(220, 248, 199)' },
        title: record.createdAt ? `Created At: ${dayjs(record.createdAt).format('DD/MM/YYYY HH:mm:ss')}` : 'N/A',
      }),
    })),
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => value ? dayjs(value).format('D/M/YY') : 'N/A',
      width: 100,
      onCell: (record) => ({
        style: { backgroundColor: 'rgb(220, 248, 199)' },
        title: record.createdAt ? `Created At: ${dayjs(record.createdAt).format('DD/MM/YYYY HH:mm:ss')}` : 'N/A',
      }),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (date) => dayjs(date).format('DD-MM-YYYY'),
      width: 100,
    },
  ];

  const branchChartData = useMemo(() => {
    const branchTotals = {};
    filteredEntries.forEach((entry) => {
      const branchName = entry.branchId?.name || 'Unknown Branch';
      const expense = entry.expenses || 0;
      branchTotals[branchName] = (branchTotals[branchName] || 0) + expense;
    });

    const labels = [];
    const data = [];
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225', '#FF5733'];

    Object.entries(branchTotals).forEach(([branchName, amount]) => {
      if (amount > 0) {
        labels.push(branchName);
        data.push(amount);
      }
    });

    return {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 1 }],
    };
  }, [filteredEntries]);

  const categoryChartData = useMemo(() => {
    const categoryTotals = {};
    filteredEntries.forEach((entry) => {
      entry.expenseDetails.forEach((detail) => {
        const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
        const amount = detail.amount || 0;
        categoryTotals[reason] = (categoryTotals[reason] || 0) + amount;
      });
    });

    const labels = [];
    const data = [];
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225', '#FF5733'];

    expenseCategories.forEach((category) => {
      const amount = categoryTotals[category] || 0;
      if (amount > 0) {
        labels.push(category);
        data.push(amount);
      }
    });

    return {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 1 }],
    };
  }, [filteredEntries]);

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: {
          color: '#000',
          font: { weight: 'bold', size: 14 },
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
                  text: `${label}: ₹${formatNumber(value)} (${percentage}%)`,
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
            return [`${label}: ₹${formatNumber(value)}`, `(${percentage}%)`];
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
          return `₹${formatNumber(value)} (${percentage}%)`;
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
          let fontSize = percentage < 1 ? 10 : percentage <= 5 ? 14 : 16;
          return { weight: 'bold', size: fontSize };
        },
        textAlign: 'center',
      },
    },
    maintainAspectRatio: false,
  };

  const branchChartOptions = { ...chartOptions };
  const categoryChartOptions = { ...chartOptions };

  const barChartData = useMemo(() => {
    const currentDate = dayjs();
    const targetMonth = currentDate.month();
    const targetYear = currentDate.year();
    const daysInMonth = currentDate.daysInMonth();

    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const dailyExpenses = Array(daysInMonth).fill(0);
    const dailyCategoryExpenses = Array(daysInMonth).fill().map(() => ({}));

    filteredEntries.forEach((entry) => {
      const date = dayjs(entry.date);
      if (date.month() === targetMonth && date.year() === targetYear) {
        const dayIndex = date.date() - 1;
        dailyExpenses[dayIndex] += entry.expenses || 0;
        entry.expenseDetails.forEach((detail) => {
          const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
          dailyCategoryExpenses[dayIndex][reason] = (dailyCategoryExpenses[dayIndex][reason] || 0) + (detail.amount || 0);
        });
      }
    });

    const maxExpense = Math.max(...dailyExpenses, 1);

    return {
      labels,
      datasets: [{
        label: 'Daily Expenses',
        data: dailyExpenses,
        backgroundColor: '#36A2EB',
        borderColor: '#36A2EB',
        borderWidth: 1,
      }],
      maxExpense,
      dailyCategoryExpenses,
    };
  }, [filteredEntries]);

  const barChartOptions = {
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { weight: 'bold' } },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dayIndex = context.dataIndex;
            const totalAmount = context.raw || 0;
            const categories = barChartData.dailyCategoryExpenses[dayIndex];
            const tooltipLines = [`Amount: ₹${formatNumber(totalAmount)}`];
            expenseCategories.forEach((category) => {
              const amount = categories[category] || 0;
              if (amount > 0) {
                tooltipLines.push(`${category}: ₹${formatNumber(amount)}`);
              }
            });
            return tooltipLines;
          },
        },
      },
      datalabels: {
        display: true,
        color: '#FFFFFF',
        backgroundColor: '#000000',
        borderRadius: 3,
        padding: 4,
        formatter: (value) => (value > 0 ? `₹${formatNumber(value)}` : ''),
        anchor: 'end',
        align: 'top',
        font: { weight: 'bold', size: 12 },
        textAlign: 'center',
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Date', font: { weight: 'bold' } },
        ticks: { autoSkip: false },
      },
      y: {
        title: { display: true, text: 'Amount (₹)', font: { weight: 'bold' } },
        beginAtZero: true,
        max: Math.ceil(barChartData.maxExpense * 1.1),
        ticks: { callback: (value) => `₹${formatNumber(value)}` },
      },
    },
    maintainAspectRatio: false,
  };

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
            body { margin: 0; padding: 0; background: #fff; }
            .filter-section, .bar-chart-section { display: none; }
            .table-section, .charts-section { width: 100%; margin: 0; box-shadow: none; border: none; page-break-inside: avoid; }
            .ant-table { font-size: 10px; }
            .ant-table th, .ant-table td { padding: 4px !important; }
            .charts-section { display: flex; flex-direction: column; justify-content: center; page-break-before: auto; }
            @page { size: A4; margin: 10mm; }
          }
          .charts-section {
            display: flex; flex-direction: column; width: 100%; max-width: 1600px;
            gap: 20px; margin-bottom: 40px;
          }
          .doughnut-row {
            display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; width: 100%;
          }
          .chart-container.doughnut {
            flex: 1; min-width: 400px; max-width: 600px; height: 60vh; min-height: 400px;
          }
          .doughnut-card {
            width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #fff; padding: 20px; display: flex; justify-content: center; align-items: center;
          }
          .chart-container.bar {
            width: 100%; max-width: 1600px; height: 50vh; min-height: 400px;
          }
          .bar-card {
            width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #fff; padding: 20px; display: flex; justify-content: center; align-items: center;
          }
          @media (max-width: 1200px) {
            .chart-container.doughnut { min-width: 350px; max-width: 500px; height: 50vh; min-height: 350px; }
            .chart-container.bar { max-width: 1200px; height: 45vh; min-height: 350px; }
          }
          @media (max-width: 768px) {
            .chart-container.doughnut { min-width: 300px; max-width: 450px; height: 45vh; min-height: 300px; }
            .chart-container.bar { max-width: 1000px; height: 40vh; min-height: 300px; }
          }
          @media (max-width: 480px) {
            .chart-container.doughnut { min-width: 250px; max-width: 400px; height: 40vh; min-height: 250px; }
            .chart-container.bar { max-width: 850px; height: 35vh; min-height: 250px; }
          }
          @media print {
            .chart-container.doughnut { width: 45%; height: 30vh; min-height: 250px; }
            .chart-container.bar { width: 100%; height: 30vh; min-height: 250px; }
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
                <Text strong style={{ marginBottom: '5px' }}>Search</Text>
                <Search
                  placeholder="Search by branch, recipient, amount, or reason"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 300 }}
                  allowClear
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>Date</Text>
                <Space>
                  <Select
                    value={dateFilterType}
                    onChange={handleDateFilterChange}
                    style={{ width: 150 }}
                  >
                    <Option value="today">Today</Option>
                    <Option value="yesterday">Yesterday</Option>
                    <Option value="last7days">Last 7 Days</Option>
                    <Option value="last30days">Last 30 Days</Option>
                    <Option value="custom">Custom Date</Option>
                  </Select>
                  {dateFilterType === 'custom' && (
                    <RangePicker
                      value={dateRangeFilter}
                      onChange={(dates) => setDateRangeFilter(dates)}
                      format="YYYY-MM-DD"
                      style={{ width: 200 }}
                    />
                  )}
                </Space>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>Branch</Text>
                <Select
                  placeholder="All Branches"
                  value={branchFilter}
                  onChange={(value) => setBranchFilter(value)}
                  allowClear
                  style={{ width: 200 }}
                >
                  <Option value={null}>All Branches</Option>
                  {branches.map((branch) => (
                    <Option key={branch._id} value={branch._id}>{branch.name}</Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>Expense Category</Text>
                <Select
                  placeholder="All Categories"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value)}
                  allowClear
                  style={{ width: 200 }}
                >
                  <Option value={null}>All Categories</Option>
                  {expenseCategories.map((category) => (
                    <Option key={category} value={category}>
                      {category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>View</Text>
                <Switch
                  checked={showSummaryTable}
                  onChange={(checked) => setShowSummaryTable(checked)}
                  checkedChildren="Summary"
                  unCheckedChildren="Detailed"
                  style={{ backgroundColor: showSummaryTable ? '#1890ff' : '#d3d3d3' }}
                />
              </div>
            </Space>
            <Space>
              <Button type="default" icon={<RedoOutlined />} onClick={handleReset}>Reset</Button>
              <Button type="default" icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
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
                columns={showSummaryTable ? summaryColumns : detailedColumns}
                dataSource={showSummaryTable ? categoryTotals : filteredEntries}
                rowKey={showSummaryTable ? 'category' : '_id'}
                pagination={{ pageSize: 10 }}
                bordered
                scroll={{ x: 'max-content' }}
                summary={(data) => {
                  if (!data.length) return null;
                  const totals = data.reduce(
                    (acc, record) => {
                      branches.forEach((branch) => {
                        acc.branchTotals[branch._id] = (acc.branchTotals[branch._id] || 0) + (record.branchAmounts[branch._id] || 0);
                      });
                      acc.grandTotal += record.total || 0;
                      return acc;
                    },
                    {
                      branchTotals: {},
                      grandTotal: 0,
                    }
                  );

                  return (
                    <Table.Summary.Row style={{ backgroundColor: '#f0f0f0' }}>
                      <Table.Summary.Cell index={0}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      {branches.map((branch, idx) => (
                        <Table.Summary.Cell key={branch._id} index={2 + idx}>
                          <Text strong style={{ fontSize: '18px', fontWeight: '700' }}>
                            ₹{formatNumber(totals.branchTotals[branch._id] || 0)}
                          </Text>
                        </Table.Summary.Cell>
                      ))}
                      <Table.Summary.Cell index={2 + branches.length}>
                        <Text strong style={{ fontSize: '18px', fontWeight: '700' }}>
                          ₹{formatNumber(totals.grandTotal)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3 + branches.length} />
                    </Table.Summary.Row>
                  );
                }}
              />
            </Card>
            <div className="charts-section">
              {filteredEntries.length > 0 ? (
                <>
                  <div className="doughnut-row">
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
                  </div>
                  <Card className="bar-card">
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                        Date-Wise Expenses
                      </Text>
                      <div className="chart-container bar">
                        <Bar data={barChartData} options={barChartOptions} />
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
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseEntry;