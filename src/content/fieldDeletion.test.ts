import { expect, test } from 'bun:test';
import {
  containsApiErrorCode,
  createFieldsMetadataRequest,
  extractFieldDependencies,
  extractRecordFormObjectType,
  filterCustomFields,
  getShortUserFacingMessage,
  normalizeFieldTypeForApi,
  parseCustomFields,
} from './fieldDeletion';

test('accepts only short plain-text API messages for display', () => {
  expect(getShortUserFacingMessage('  Field cannot be deleted.  ')).toBe(
    'Field cannot be deleted.'
  );
  expect(getShortUserFacingMessage('<html><body>Bad Gateway</body></html>')).toBeNull();
  expect(getShortUserFacingMessage('x'.repeat(241))).toBeNull();
  expect(getShortUserFacingMessage('Error\u0000details')).toBeNull();
});
test('requests object field metadata with Fireberry POST contract', () => {
  const request = createFieldsMetadataRequest();

  expect(request.method).toBe('POST');
  expect(request.body).toBe('{}');
  expect(request.credentials).toBe('same-origin');
});

test('uses the current page RecordForm object type instead of layout metadata', () => {
  const objectType = extractRecordFormObjectType({
    objectType: 108,
    layout: [
      {
        columns: [
          {
            components: [
              { name: 'RecordHeader', props: { objectType: 108 } },
              { name: 'RecordForm', props: { objectType: 1 } },
            ],
          },
        ],
      },
    ],
  });

  expect(objectType).toBe(1);
});

test('normalizes and deduplicates custom fields from nested metadata', () => {
  const fields = parseCustomFields({
    data: {
      fields: [
        { fieldname: 'accountid', name: 'מזהה לקוח', typename: 'guid' },
        { fieldname: 'pcf_renewaldate', name: 'תאריך חידוש', typename: 'date' },
        { FieldName: 'PCF_PLAN', DisplayName: 'סוג מסלול', FieldTypeName: 'picklist' },
        { fieldName: 'pcf_renewaldate', label: 'כפילות', type: 'date' },
        { fieldname: 'pcf_score', fieldlabel: 'ציון', fieldtype: 'number' },
      ],
    },
  });

  expect(fields).toEqual([
    {
      fieldName: 'PCF_PLAN',
      displayName: 'סוג מסלול',
      typeLabel: 'picklist',
      apiType: 'picklist',
    },
    {
      fieldName: 'pcf_score',
      displayName: 'ציון',
      typeLabel: 'number',
      apiType: 'number',
    },
    {
      fieldName: 'pcf_renewaldate',
      displayName: 'תאריך חידוש',
      typeLabel: 'date',
      apiType: 'date',
    },
  ]);
});

test('filters custom fields by display name or API name', () => {
  const fields = [
    { fieldName: 'pcf_renewaldate', displayName: 'תאריך חידוש', typeLabel: 'date' },
    { fieldName: 'pcf_plantype', displayName: 'סוג מסלול', typeLabel: 'picklist' },
  ];

  expect(filterCustomFields(fields, 'חידוש')).toEqual([fields[0]]);
  expect(filterCustomFields(fields, 'PLAN')).toEqual([fields[1]]);
  expect(filterCustomFields(fields, '   ')).toEqual(fields);
});

test('detects FIELD_IN_FORM in nested Fireberry error payloads', () => {
  expect(
    containsApiErrorCode(
      { error: { data: { Message: 'FIELD_IN_FORM' } } },
      'FIELD_IN_FORM'
    )
  ).toBe(true);
  expect(containsApiErrorCode('FIELD_IN_FORM', 'FIELD_IN_FORM')).toBe(true);
  expect(containsApiErrorCode({ Message: 'FIELD_IN_VIEW' }, 'FIELD_IN_FORM')).toBe(
    false
  );
});

test('normalizes Fireberry field types for the official delete endpoint', () => {
  expect(normalizeFieldTypeForApi('Long Text')).toBe('textarea');
  expect(normalizeFieldTypeForApi('Dropdown')).toBe('picklist');
  expect(normalizeFieldTypeForApi('telephone')).toBe('phone');
  expect(normalizeFieldTypeForApi('unknown type')).toBeNull();
});

test('extracts and links structured Fireberry field dependencies', () => {
  const dependencies = extractFieldDependencies(
    {
      data: {
        forms: [
          {
            formName: 'עמוד לקוח ראשי',
            recordLayoutId: 'layout-1',
          },
        ],
        views: [{ viewName: 'לקוחות פעילים', viewSchemaId: 'view-1' }],
        automations: [
          {
            ruleName: 'יצירת משימת מעקב',
            wfruleid: 'rule-1',
          },
        ],
      },
    },
    1
  );

  expect(dependencies).toEqual([
    {
      kind: 'page',
      name: 'עמוד לקוח ראשי',
      url: '/app/record/108/layout-1',
    },
    {
      kind: 'view',
      name: 'לקוחות פעילים',
      url: '/app/views/1/view-1',
    },
    {
      kind: 'automation',
      name: 'יצירת משימת מעקב',
      url: '/app/record/55/rule-1',
    },
  ]);
});
