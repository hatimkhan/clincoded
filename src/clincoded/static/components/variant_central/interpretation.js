'use strict';
var React = require('react');
var globals = require('../globals');

var queryKeyValue = globals.queryKeyValue;
var editQueryValue = globals.editQueryValue;

// Import react-tabs npm to create tabs
var ReactTabs = require('react-tabs');
var Tab = ReactTabs.Tab;
var Tabs = ReactTabs.Tabs;
var TabList = ReactTabs.TabList;
var TabPanel = ReactTabs.TabPanel;

// Prevent react-tabs default styles being used on tabs
Tabs.setUseDefaultStyles(false);

// Import individual tab components
var CurationInterpretationBasicInfo = require('./interpretation/basic_info').CurationInterpretationBasicInfo;
var CurationInterpretationPopulation = require('./interpretation/population').CurationInterpretationPopulation;
var CurationInterpretationComputational = require('./interpretation/computational').CurationInterpretationComputational;
var CurationInterpretationFunctional = require('./interpretation/functional').CurationInterpretationFunctional;
var CurationInterpretationSegregation = require('./interpretation/segregation').CurationInterpretationSegregation;
var CurationInterpretationGeneSpecific = require('./interpretation/gene_specific').CurationInterpretationGeneSpecific;

// list of tabs, in order of how they appear on the tab list
// these values will be appended to the address as you switch tabs
var tabList = [
    'basic-info',
    'population',
    'computational',
    'functional',
    'segregation-case',
    'gene-specific'
];

// Curation data header for Gene:Disease
var VariantCurationInterpretation = module.exports.VariantCurationInterpretation = React.createClass({
    propTypes: {
        variantData: React.PropTypes.object, // ClinVar data payload
        interpretation: React.PropTypes.object,
        loadingComplete: React.PropTypes.bool,
        updateInterpretationObj: React.PropTypes.func,
        href: React.PropTypes.string
    },

    getInitialState: function() {
        return {
            selectedTab: (this.props.href ? tabList.indexOf(queryKeyValue('tab', this.props.href)) : 0) // set selectedTab to whatever is defined in the address; default to first tab if not set
        };
    },

    // set selectedTab to whichever tab the user switches to, and update the address accordingly
    handleSelect: function (index, last) {
        this.setState({selectedTab: index});
        if (index == 0) {
            window.history.replaceState(window.state, '', editQueryValue(this.props.href, 'tab', null));
        } else {
            window.history.replaceState(window.state, '', editQueryValue(this.props.href, 'tab', tabList[index]));
        }
    },

    render: function() {
        var variant = this.props.variantData;
        var interpretation = this.props.interpretation;
        var loadingComplete = this.props.loadingComplete;

        // The ordering of TabPanels are corresponding to that of tabs
        // Adding or deleting a tab also requires its corresponding TabPanel to be added/deleted
        return (
            <div className="container curation-variant-tab-group">
                <Tabs onSelect={this.handleSelect} selectedIndex={this.state.selectedTab}>
                    <TabList className="tab-label-list">
                        <Tab className="tab-label col-sm-2">Basic Information</Tab>
                        <Tab className="tab-label col-sm-2">Population</Tab>
                        <Tab className="tab-label col-sm-2">Computational</Tab>
                        <Tab className="tab-label col-sm-2">Functional</Tab>
                        <Tab className="tab-label col-sm-2">Segregation/Case</Tab>
                        <Tab className="tab-label col-sm-2">Gene-specific</Tab>
                    </TabList>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationBasicInfo data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationPopulation data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationComputational data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationFunctional data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationSegregation data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                    <TabPanel>
                        <div className="tab-panel"><CurationInterpretationGeneSpecific data={variant} shouldFetchData={loadingComplete} interpretation={interpretation} updateInterpretationObj={this.props.updateInterpretationObj} /></div>
                    </TabPanel>
                </Tabs>
            </div>
        );
    }
});
