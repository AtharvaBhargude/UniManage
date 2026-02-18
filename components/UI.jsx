import React, { useId } from 'react';

const toFieldName = (text) => String(text || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const Button = ({ variant = 'primary', className = '', ...props }) => {
  return (
    <button className={`ui-btn ui-btn-${variant} ${className}`} {...props} />
  );
};

export const Input = ({ label, className = '', id, name, ...props }) => {
  const rid = useId().replace(/:/g, '');
  const fieldId = id || `input_${rid}`;
  const fieldName = name || toFieldName(label) || fieldId;

  return (
    <div className="ui-input-wrapper">
      {label && <label className="ui-label" htmlFor={fieldId}>{label}</label>}
      <input
        id={fieldId}
        name={fieldName}
        className={`ui-input ${className}`}
        {...props}
      />
    </div>
  );
};

export const Select = ({ label, options, className = '', id, name, ...props }) => {
  const rid = useId().replace(/:/g, '');
  const fieldId = id || `select_${rid}`;
  const fieldName = name || toFieldName(label) || fieldId;

  return (
    <div className="ui-input-wrapper">
      {label && <label className="ui-label" htmlFor={fieldId}>{label}</label>}
      <select
        id={fieldId}
        name={fieldName}
        className={`ui-select ${className}`}
        {...props}
      >
        <option value="">Select an option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export const Card = ({ children, className = '', title }) => {
  return (
    <div className={`ui-card ${className}`}>
      {title && (
        <div className="ui-card-header">
          <h3 className="ui-card-title">{title}</h3>
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  );
};

export const Badge = ({ children, color = 'blue' }) => {
  return (
    <span className={`ui-badge ui-badge-${color}`}>
      {children}
    </span>
  );
};
