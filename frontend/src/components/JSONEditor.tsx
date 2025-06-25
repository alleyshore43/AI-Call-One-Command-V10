import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface JSONEditorProps {
  value: any;
  onChange: (value: any) => void;
}

export const JSONEditor: React.FC<JSONEditorProps> = ({ value, onChange }) => {
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'visual' | 'raw'>('visual');

  // Convert the JSON object to a string when the component mounts or value changes
  useEffect(() => {
    try {
      setJsonString(JSON.stringify(value, null, 2));
    } catch (err) {
      console.error('Error stringifying JSON:', err);
      setError('Invalid JSON object');
    }
  }, [value]);

  // Handle changes to the raw JSON string
  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonString(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      onChange(parsed);
      setError(null);
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
    }
  };

  // Handle adding a new property to the schema
  const handleAddProperty = () => {
    const newSchema = { ...value };
    if (!newSchema.properties) {
      newSchema.properties = {};
    }
    
    // Find a unique property name
    let propName = 'new_property';
    let counter = 1;
    while (newSchema.properties[propName]) {
      propName = `new_property_${counter}`;
      counter++;
    }
    
    newSchema.properties[propName] = {
      type: 'string',
      description: 'Description of this property'
    };
    
    onChange(newSchema);
  };

  // Handle adding a property to the required array
  const handleToggleRequired = (propName: string) => {
    const newSchema = { ...value };
    if (!newSchema.required) {
      newSchema.required = [];
    }
    
    if (newSchema.required.includes(propName)) {
      newSchema.required = newSchema.required.filter((name: string) => name !== propName);
    } else {
      newSchema.required.push(propName);
    }
    
    onChange(newSchema);
  };

  // Handle updating a property's type
  const handleUpdatePropertyType = (propName: string, type: string) => {
    const newSchema = { ...value };
    if (newSchema.properties && newSchema.properties[propName]) {
      newSchema.properties[propName].type = type;
      onChange(newSchema);
    }
  };

  // Handle updating a property's description
  const handleUpdatePropertyDescription = (propName: string, description: string) => {
    const newSchema = { ...value };
    if (newSchema.properties && newSchema.properties[propName]) {
      newSchema.properties[propName].description = description;
      onChange(newSchema);
    }
  };

  // Handle updating a property's name
  const handleUpdatePropertyName = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    
    const newSchema = { ...value };
    if (newSchema.properties && newSchema.properties[oldName]) {
      // Create a new property with the new name
      newSchema.properties[newName] = { ...newSchema.properties[oldName] };
      
      // Delete the old property
      delete newSchema.properties[oldName];
      
      // Update required array if needed
      if (newSchema.required && newSchema.required.includes(oldName)) {
        newSchema.required = newSchema.required.map((name: string) => 
          name === oldName ? newName : name
        );
      }
      
      onChange(newSchema);
    }
  };

  // Handle deleting a property
  const handleDeleteProperty = (propName: string) => {
    const newSchema = { ...value };
    if (newSchema.properties && newSchema.properties[propName]) {
      delete newSchema.properties[propName];
      
      // Remove from required array if needed
      if (newSchema.required && newSchema.required.includes(propName)) {
        newSchema.required = newSchema.required.filter((name: string) => name !== propName);
      }
      
      onChange(newSchema);
    }
  };

  // Handle adding enum values to a property
  const handleAddEnum = (propName: string, enumValues: string) => {
    const newSchema = { ...value };
    if (newSchema.properties && newSchema.properties[propName]) {
      try {
        // Parse the enum values as a JSON array if it starts with [
        if (enumValues.trim().startsWith('[')) {
          newSchema.properties[propName].enum = JSON.parse(enumValues);
        } else {
          // Otherwise split by commas and trim
          newSchema.properties[propName].enum = enumValues
            .split(',')
            .map(v => v.trim())
            .filter(v => v);
        }
        onChange(newSchema);
      } catch (err) {
        console.error('Error parsing enum values:', err);
      }
    }
  };

  // Toggle between visual and raw editing modes
  const toggleEditMode = () => {
    setEditMode(editMode === 'visual' ? 'raw' : 'visual');
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button onClick={toggleEditMode}>
          {editMode === 'visual' ? 'Switch to Raw JSON' : 'Switch to Visual Editor'}
        </Button>
      </Box>

      {editMode === 'raw' ? (
        <Box>
          <TextField
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={jsonString}
            onChange={handleRawChange}
            error={!!error}
            helperText={error}
          />
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Properties
          </Typography>
          
          {value.properties && Object.keys(value.properties).length > 0 ? (
            Object.entries(value.properties).map(([propName, propValue]: [string, any]) => (
              <Paper key={propName} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <TextField
                    label="Property Name"
                    value={propName}
                    onChange={(e) => handleUpdatePropertyName(propName, e.target.value)}
                    size="small"
                    sx={{ width: '30%' }}
                  />
                  <Box>
                    <Button
                      size="small"
                      color={value.required?.includes(propName) ? 'primary' : 'inherit'}
                      onClick={() => handleToggleRequired(propName)}
                      sx={{ mr: 1 }}
                    >
                      {value.required?.includes(propName) ? 'Required' : 'Optional'}
                    </Button>
                    <Tooltip title="Delete Property">
                      <IconButton size="small" color="error" onClick={() => handleDeleteProperty(propName)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Box display="flex" gap={2} mb={1}>
                  <TextField
                    select
                    label="Type"
                    value={propValue.type || 'string'}
                    onChange={(e) => handleUpdatePropertyType(propName, e.target.value)}
                    size="small"
                    SelectProps={{
                      native: true,
                    }}
                    sx={{ width: '30%' }}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                  </TextField>
                  
                  {propValue.type === 'string' && (
                    <TextField
                      label="Enum Values (comma separated)"
                      value={propValue.enum ? (Array.isArray(propValue.enum) ? propValue.enum.join(', ') : propValue.enum) : ''}
                      onChange={(e) => handleAddEnum(propName, e.target.value)}
                      size="small"
                      sx={{ width: '70%' }}
                      placeholder="value1, value2, value3"
                    />
                  )}
                </Box>
                
                <TextField
                  label="Description"
                  value={propValue.description || ''}
                  onChange={(e) => handleUpdatePropertyDescription(propName, e.target.value)}
                  size="small"
                  fullWidth
                />
              </Paper>
            ))
          ) : (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              No properties defined yet. Click "Add Property" to get started.
            </Typography>
          )}
          
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddProperty}
            variant="outlined"
            size="small"
          >
            Add Property
          </Button>
        </Box>
      )}
    </Box>
  );
};