import { expect, test } from 'bun:test';
import {
  containsApiErrorCode,
  createFieldsMetadataRequest,
  extractRecordFormObjectType,
  filterCustomFields,
  parseCustomFields,
} from './fieldDeletion';

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
    { fieldName: 'PCF_PLAN', displayName: 'סוג מסלול', typeLabel: 'picklist' },
    { fieldName: 'pcf_score', displayName: 'ציון', typeLabel: 'number' },
    { fieldName: 'pcf_renewaldate', displayName: 'תאריך חידוש', typeLabel: 'date' },
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
