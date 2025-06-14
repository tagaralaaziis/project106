import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Grid, 
  Typography, 
  Box, 
  Divider, 
  Skeleton,
  ToggleButtonGroup,
  ToggleButton,
  Tab,
  Tabs,
  Button,
  CircularProgress,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { BarChart3, Calendar, FileSpreadsheet, Download, Table } from 'lucide-react';
import { DataType } from '../../types';
import TemperatureChart from '../charts/TemperatureChart';
import HumidityChart from '../charts/HumidityChart';
import ElectricalChart from '../charts/ElectricalChart';
import { format } from 'date-fns';
import { useSocket } from '../../contexts/SocketContext';

interface HistoricalDataSectionProps {
  data: DataType;
  loading: boolean;
  isMobile: boolean;
}

const HistoricalDataSection = ({ data, loading, isMobile }: HistoricalDataSectionProps) => {
  const [timeRange, setTimeRange] = useState('realtime');
  const [activeTab, setActiveTab] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const { socket } = useSocket();
  const [historicalData, setHistoricalData] = useState(data.historical);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!socket) return;

    // Request initial data
    socket.emit('request_historical_data', { timeRange });

    // Listen for historical data updates
    socket.on('historical_data_update', (newData) => {
      setHistoricalData(newData);
      setLastUpdate(new Date());
    });

    // Set up polling interval based on timeRange
    const interval = setInterval(() => {
      socket.emit('request_historical_data', { timeRange });
    }, timeRange === 'realtime' ? 60000 : // 1 minute for realtime
       timeRange === '1h' ? 60000 : // 1 minute for 1h view
       10000); // 10 seconds for other views

    return () => {
      socket.off('historical_data_update');
      clearInterval(interval);
    };
  }, [socket, timeRange]);

  const handleTimeRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    newTimeRange: string | null,
  ) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
      socket?.emit('request_historical_data', { timeRange: newTimeRange });
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const exportData = async () => {
    try {
      setExportLoading(true);
      handleExportClose();

      const baseUrl = import.meta.env.VITE_SOCKET_SERVER || 'http://10.10.1.25:3000';
      let endpoint = '';
      
      switch (activeTab) {
        case 0:
          endpoint = 'temperature';
          break;
        case 1:
          endpoint = 'humidity';
          break;
        case 2:
          endpoint = 'electrical';
          break;
        default:
          throw new Error('Invalid tab selection');
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${baseUrl}/api/export/${endpoint}?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Accept': 'text/csv'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          window.location.reload();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const fileName = `${endpoint}_data_${timeRange}_${timestamp}.csv`;
      
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const getTabLabel = (index: number) => {
    switch (index) {
      case 0:
        return 'Temperature Data';
      case 1:
        return 'Humidity Data';
      case 2:
        return 'Electrical Data';
      default:
        return '';
    }
  };

  const getDataPointCount = () => {
    const activeData = activeTab === 0 
      ? historicalData.temperature?.noc 
      : activeTab === 1 
        ? historicalData.humidity?.noc 
        : historicalData.electrical;
    
    return activeData?.length || 0;
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'realtime':
        return 'Real-time (1 min intervals)';
      case '1h':
        return 'Last Hour';
      case '24h':
        return 'Last 24 Hours';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      default:
        return '';
    }
  };

  return (
    <Card 
      sx={{ 
        backgroundImage: 'linear-gradient(to bottom right, rgba(30, 30, 60, 0.4), rgba(30, 30, 60, 0.1))',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      className="card"
    >
      <CardHeader 
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BarChart3 size={24} color="#3f88f2" />
            <Typography variant="h5" sx={{ ml: 1, fontWeight: 600 }}>
              Historical Data
            </Typography>
          </Box>
        } 
        action={
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={handleExportClick}
              startIcon={exportLoading ? <CircularProgress size={20} /> : <FileSpreadsheet size={20} />}
              disabled={exportLoading}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(63, 136, 242, 0.1)',
                }
              }}
            >
              Export Data
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={handleExportClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 180,
                  backdropFilter: 'blur(10px)',
                  backgroundColor: 'rgba(26, 26, 46, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }
              }}
            >
              <MenuItem onClick={exportData}>
                <ListItemIcon>
                  <Table size={18} />
                </ListItemIcon>
                <ListItemText>Export as CSV</ListItemText>
              </MenuItem>
            </Menu>
            <ToggleButtonGroup
              size="small"
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              aria-label="time range"
              sx={{ 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '.MuiToggleButton-root': {
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    backgroundColor: 'rgba(63, 136, 242, 0.1)',
                  }
                } 
              }}
            >
              <ToggleButton value="realtime" aria-label="realtime">
                Realtime
              </ToggleButton>
              <ToggleButton value="1h" aria-label="1 hour">
                1H
              </ToggleButton>
              <ToggleButton value="24h" aria-label="24 hours">
                24H
              </ToggleButton>
              <ToggleButton value="7d" aria-label="7 days">
                7D
              </ToggleButton>
              <ToggleButton value="30d" aria-label="30 days">
                30D
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
        sx={{ pb: 0 }}
      />
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant={isMobile ? "scrollable" : "fullWidth"}
          scrollButtons={isMobile ? "auto" : false}
          sx={{ 
            '.MuiTab-root': { 
              textTransform: 'none',
              fontWeight: 500,
              minHeight: '48px',
            } 
          }}
        >
          <Tab 
            label="Temperature" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
          <Tab 
            label="Humidity" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
          <Tab 
            label="Electrical" 
            icon={<Calendar size={16} />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      <CardContent>
        {loading ? (
          <Skeleton variant="rectangular\" height={300} width="100%" />
        ) : (
          <Box sx={{ mt: 1 }}>
            {activeTab === 0 && (
              <TemperatureChart 
                nocData={historicalData.temperature?.noc || []} 
                upsData={historicalData.temperature?.ups || []} 
                timeRange={timeRange}
              />
            )}
            
            {activeTab === 1 && (
              <HumidityChart 
                nocData={historicalData.humidity?.noc || []} 
                upsData={historicalData.humidity?.ups || []} 
                timeRange={timeRange}
              />
            )}
            
            {activeTab === 2 && (
              <ElectricalChart 
                data={historicalData.electrical || []} 
                timeRange={timeRange}
              />
            )}
          </Box>
        )}
        
        <Box 
          sx={{ 
            mt: 2, 
            p: 2,
            borderRadius: 2,
            bgcolor: 'rgba(63, 136, 242, 0.1)', 
            border: '1px solid rgba(63, 136, 242, 0.2)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Current View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getTabLabel(activeTab)} • {getTimeRangeLabel()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Data Points
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getDataPointCount()} samples
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="primary.light" sx={{ mb: 0.5 }}>
              Last Updated
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {format(lastUpdate, 'dd MMM yyyy HH:mm:ss')}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HistoricalDataSection;