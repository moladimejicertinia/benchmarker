/*
 * Copyright (c) 2025 Certinia, inc. All rights reserved.
 */

import {
  getAverageLimitValuesFromDB,
  saveAlerts,
  checkRecentUiAlerts,
  buildKey,
} from '../../src/database/uiAlertInfo';
import * as db from '../../src/database/connection';
import sinon from 'sinon';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { DataSource } from 'typeorm';
import { UiAlert } from '../../src/database/entity/uiAlert';
import { UiTestResult } from '../../src/database/entity/uiTestResult';

chai.use(sinonChai);

describe('src/database/uiAlertInfo', () => {
  let mockQuery: sinon.SinonStub;
  let connectionStub: sinon.SinonStub;
  let mockDataSource: any;

  beforeEach(() => {
    mockQuery = sinon.stub();
    mockDataSource = { query: mockQuery };
    connectionStub = sinon.stub(db, 'getConnection').resolves(mockDataSource);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getAverageLimitValuesFromDB', () => {
    it('should return average limit values for valid data', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
        {
          testSuiteName: 'testSuiteName2',
          individualTestName: 'individualTestName2',
          lwsEnabled: false,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          count_older_than_15_days: 20,
        },
        {
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          count_older_than_15_days: 18,
        },
      ];

      const mockAvgResults = [
        {
          test_suite_name: 'testSuiteName1',
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
        {
          test_suite_name: 'testSuiteName2',
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);
      mockQuery.onSecondCall().resolves(mockAvgResults);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(mockQuery.calledTwice).to.be.true;
      expect(mockQuery.args[1][0]).to.include('SELECT');
      expect(mockQuery.args[1][0]).to.include(
        '(test_suite_name, individual_test_name, lws_enabled) IN'
      );
      expect(mockQuery.args[1][1]).to.deep.equal([
        'testSuiteName1', 'individualTestName1', false,
        'testSuiteName2', 'individualTestName2', false,
      ]);

      const key1 = buildKey('testSuiteName1', 'individualTestName1', false);
      const key2 = buildKey('testSuiteName2', 'individualTestName2', false);
      expect(results).to.deep.equal({
        [key1]: {
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
        [key2]: {
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
      });
    });

    it('should scope averages by lwsEnabled and keep LWS on/off results isolated', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'suite1',
          individualTestName: 'test1',
          lwsEnabled: false,
        },
        {
          testSuiteName: 'suite1',
          individualTestName: 'test1',
          lwsEnabled: true,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'test1',
          lws_enabled: false,
          count_older_than_15_days: 10,
        },
        {
          individual_test_name: 'test1',
          lws_enabled: true,
          count_older_than_15_days: 5,
        },
      ];

      const mockAvgResults = [
        {
          test_suite_name: 'suite1',
          individual_test_name: 'test1',
          lws_enabled: false,
          avg_load_time_past_5_days: 100,
          avg_load_time_6_to_15_days_ago: 90,
        },
        {
          test_suite_name: 'suite1',
          individual_test_name: 'test1',
          lws_enabled: true,
          avg_load_time_past_5_days: 200,
          avg_load_time_6_to_15_days_ago: 150,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);
      mockQuery.onSecondCall().resolves(mockAvgResults);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      const keyOff = buildKey('suite1', 'test1', false);
      const keyOn = buildKey('suite1', 'test1', true);
      expect(results).to.deep.equal({
        [keyOff]: {
          avg_load_time_past_5_days: 100,
          avg_load_time_6_to_15_days_ago: 90,
        },
        [keyOn]: {
          avg_load_time_past_5_days: 200,
          avg_load_time_6_to_15_days_ago: 150,
        },
      });
    });

    it('should not return average limit values when a test has no results older than 15 days', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
        {
          testSuiteName: 'testSuiteName2',
          individualTestName: 'individualTestName2',
          lwsEnabled: false,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          count_older_than_15_days: 20,
        },
        {
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          count_older_than_15_days: 0,
        },
      ];

      const mockAvgResults = [
        {
          test_suite_name: 'testSuiteName1',
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);
      mockQuery.onSecondCall().resolves(mockAvgResults);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(mockQuery.calledTwice).to.be.true;
      expect(mockQuery.args[1][0]).to.include('SELECT');
      expect(mockQuery.args[1][0]).to.include(
        '(test_suite_name, individual_test_name, lws_enabled) IN'
      );
      expect(mockQuery.args[1][1]).to.deep.equal([
        'testSuiteName1', 'individualTestName1', false,
      ]);

      const key1 = buildKey('testSuiteName1', 'individualTestName1', false);
      expect(results).to.deep.equal({
        [key1]: {
          avg_load_time_past_5_days: 2000,
          avg_load_time_6_to_15_days_ago: 1500,
        },
      });
    });

    it('should not return average limit values when no results older than 15 days', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
        {
          testSuiteName: 'testSuiteName2',
          individualTestName: 'individualTestName2',
          lwsEnabled: false,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          count_older_than_15_days: 0,
        },
        {
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          count_older_than_15_days: 0,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(mockQuery.calledOnce).to.be.true;

      expect(results).to.deep.equal({});
    });

    it('should return an empty object when no results are found', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          count_older_than_15_days: 20,
        },
        {
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          count_older_than_15_days: 18,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);
      mockQuery.onSecondCall().resolves([]);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(mockQuery.calledTwice).to.be.true;
      expect(results).to.deep.equal({});
    });

    it('should handle missing fields and default them to zero', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
      ];

      const mockCountResults = [
        {
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          count_older_than_15_days: 20,
        },
        {
          individual_test_name: 'individualTestName2',
          lws_enabled: false,
          count_older_than_15_days: 18,
        },
      ];

      const mockAvgResults = [
        {
          test_suite_name: 'testSuiteName1',
          individual_test_name: 'individualTestName1',
          lws_enabled: false,
          avg_load_time_past_5_days: null,
          avg_load_time_6_to_15_days_ago: undefined,
        },
      ];

      mockQuery.onFirstCall().resolves(mockCountResults);
      mockQuery.onSecondCall().resolves(mockAvgResults);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      const key1 = buildKey('testSuiteName1', 'individualTestName1', false);
      expect(results).to.deep.equal({
        [key1]: {
          avg_load_time_past_5_days: 0,
          avg_load_time_6_to_15_days_ago: 0,
        },
      });
    });

    it('should handle an empty suiteAndTestNamePairs array and return an empty object', async () => {
      // Given
      const suiteAndTestNamePairs: {
        testSuiteName: string;
        individualTestName: string;
        lwsEnabled: boolean;
      }[] = [];

      // Simulate no results (empty array)
      mockQuery.onFirstCall().resolves([]);
      mockQuery.onSecondCall().resolves([]);

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(results).to.deep.equal({});
    });

    it('should handle errors and return an empty object', async () => {
      // Given
      const suiteAndTestNamePairs = [
        {
          testSuiteName: 'testSuiteName1',
          individualTestName: 'individualTestName1',
          lwsEnabled: false,
        },
      ];

      mockQuery.rejects(new Error('Database error'));

      // When
      const results = await getAverageLimitValuesFromDB(suiteAndTestNamePairs);

      // Then
      expect(results).to.deep.equal({});
    });
  });

  describe('saveAlerts', () => {
    it('should save alert', async () => {
      // Given
      const saveStub: sinon.SinonStub = sinon.stub().resolvesArg(0);
      connectionStub.resolves({
        manager: { save: saveStub },
      } as unknown as DataSource);

      const savedEntity = new UiTestResult();
      savedEntity.id = 1;
      savedEntity.testSuiteName = 'suite';
      savedEntity.individualTestName = 'test';
      savedEntity.componentLoadTime = 10;
      savedEntity.salesforceLoadTime = 20;
      savedEntity.overallLoadTime = 30;
      savedEntity.lwsEnabled = false;

      const alert: UiAlert = new UiAlert();
      alert.testSuiteName = savedEntity.testSuiteName;
      alert.individualTestName = savedEntity.individualTestName;
      alert.lwsEnabled = false;
      alert.componentLoadTimeDegraded = 2;
      alert.alertType = 'normal';
      const results = [alert];

      // When
      const savedRecords = await saveAlerts([savedEntity], results);

      // Then
      expect(saveStub).to.be.calledOnce;
      expect(savedRecords).to.eql(results);
      expect(savedRecords[0].uiTestResultId).to.equal(1);
    });

    it('should match alert to result by lwsEnabled when saving', async () => {
      // Given
      const saveStub: sinon.SinonStub = sinon.stub().resolvesArg(0);
      connectionStub.resolves({
        manager: { save: saveStub },
      } as unknown as DataSource);

      const resultLwsOff = new UiTestResult();
      resultLwsOff.id = 1;
      resultLwsOff.testSuiteName = 'suite';
      resultLwsOff.individualTestName = 'test';
      resultLwsOff.lwsEnabled = false;

      const resultLwsOn = new UiTestResult();
      resultLwsOn.id = 2;
      resultLwsOn.testSuiteName = 'suite';
      resultLwsOn.individualTestName = 'test';
      resultLwsOn.lwsEnabled = true;

      const alertLwsOn: UiAlert = new UiAlert();
      alertLwsOn.testSuiteName = 'suite';
      alertLwsOn.individualTestName = 'test';
      alertLwsOn.lwsEnabled = true;
      alertLwsOn.componentLoadTimeDegraded = 5;
      alertLwsOn.alertType = 'normal';

      // When
      const savedRecords = await saveAlerts(
        [resultLwsOff, resultLwsOn],
        [alertLwsOn]
      );

      // Then
      expect(savedRecords[0].uiTestResultId).to.equal(2);
    });
  });

  describe('checkRecentUiAlerts', () => {
    it('should return a Set of keys for alerts found in the last 3 days', async () => {
      // Given
      const pairs = [
        { testSuiteName: 'SuiteA', individualTestName: 'Test1', lwsEnabled: false },
        { testSuiteName: 'SuiteB', individualTestName: 'Test2', lwsEnabled: false },
      ];

      const mockDbRows = [
        { test_suite_name: 'SuiteA', individual_test_name: 'Test1', lws_enabled: false },
      ];

      mockQuery.resolves(mockDbRows);

      // When
      const result = await checkRecentUiAlerts(pairs);

      // Then
      expect(mockQuery).to.have.been.calledOnce;

      const sqlQuery = mockQuery.firstCall.args[0];
      expect(sqlQuery).to.include("INTERVAL '3 days'");
      expect(sqlQuery).to.include(
        '(test_suite_name, individual_test_name, lws_enabled) IN'
      );
      expect(mockQuery.firstCall.args[1]).to.deep.equal([
        'SuiteA', 'Test1', false,
        'SuiteB', 'Test2', false,
      ]);

      expect(result).to.be.instanceOf(Set);
      expect(result.size).to.equal(1);
      expect(result.has(buildKey('SuiteA', 'Test1', false))).to.be.true;
      expect(result.has(buildKey('SuiteB', 'Test2', false))).to.be.false;
    });

    it('should scope recent alert checks by lwsEnabled', async () => {
      // Given
      const pairs = [
        { testSuiteName: 'SuiteA', individualTestName: 'Test1', lwsEnabled: false },
        { testSuiteName: 'SuiteA', individualTestName: 'Test1', lwsEnabled: true },
      ];

      const mockDbRows = [
        { test_suite_name: 'SuiteA', individual_test_name: 'Test1', lws_enabled: false },
      ];

      mockQuery.resolves(mockDbRows);

      // When
      const result = await checkRecentUiAlerts(pairs);

      // Then
      expect(result.has(buildKey('SuiteA', 'Test1', false))).to.be.true;
      expect(result.has(buildKey('SuiteA', 'Test1', true))).to.be.false;
    });

    it('should return an empty Set if no recent alerts are found', async () => {
      // Given
      mockQuery.resolves([]);

      // When
      const result = await checkRecentUiAlerts([
        { testSuiteName: 'SuiteA', individualTestName: 'Test1', lwsEnabled: false },
      ]);

      // Then
      expect(result).to.be.instanceOf(Set);
      expect(result.size).to.equal(0);
    });

    it('should handle database errors gracefully by returning an empty Set', async () => {
      // Given
      const consoleStub = sinon.stub(console, 'error');
      mockQuery.rejects(new Error('Connection failed'));

      // When
      const result = await checkRecentUiAlerts([
        { testSuiteName: 'SuiteA', individualTestName: 'Test1', lwsEnabled: false },
      ]);

      // Then
      expect(result).to.be.instanceOf(Set);
      expect(result.size).to.equal(0);
      expect(consoleStub).to.have.been.calledWith(
        sinon.match('Error checking recent UI alerts')
      );

      consoleStub.restore();
    });
  });
});
