'use strict';
var React = require('react');
var globals = require('../../globals');
var RestMixin = require('../../rest').RestMixin;
var parseClinvar = require('../../../libs/parse-resources').parseClinvar;
var vciFormHelper = require('./shared/form');
var CurationInterpretationForm = vciFormHelper.CurationInterpretationForm;
var parseAndLogError = require('../../mixins').parseAndLogError;
var genomic_chr_mapping = require('./mapping/NC_genomic_chr_format.json');

var queryKeyValue = globals.queryKeyValue;
var editQueryValue = globals.editQueryValue;

var external_url_map = globals.external_url_map;
var dbxref_prefix_map = globals.dbxref_prefix_map;

var panel = require('../../../libs/bootstrap/panel');
var form = require('../../../libs/bootstrap/form');

var externalLinks = require('./shared/externalLinks');

var PanelGroup = panel.PanelGroup;
var Panel = panel.Panel;
var Form = form.Form;
var FormMixin = form.FormMixin;
var Input = form.Input;
var InputMixin = form.InputMixin;

var computationStatic = {
    conservation: {
        _order: ['phylop7way', 'phylop20way', 'phastconsp7way', 'phastconsp20way', 'gerp', 'siphy'],
        _labels: {'phylop7way': 'phyloP7way', 'phylop20way': 'phyloP20way', 'phastconsp7way': 'phastCons7way', 'phastconsp20way': 'phastCons20way', 'gerp': 'GERP++', 'siphy': 'SiPhy'}
    },
    other_predictors: {
        _order: ['sift', 'polyphen2_hdiv', 'polyphen2_hvar', 'lrt', 'mutationtaster', 'mutationassessor', 'fathmm', 'provean', 'metasvm', 'metalr', 'cadd', 'fathmm_mkl', 'fitcons'],
        _labels: {
            'sift': 'SIFT',
            'polyphen2_hdiv': 'PolyPhen2-HDIV',
            'polyphen2_hvar': 'PolyPhen2-HVAR',
            'lrt': 'LRT',
            'mutationtaster': 'MutationTaster',
            'mutationassessor': 'MutationAssessor',
            'fathmm': 'FATHMM',
            'provean': 'PROVEAN',
            'metasvm': 'MetaSVM (meta-predictor)',
            'metalr': 'MetaLR (meta-predictor)',
            'cadd': 'CADD (meta-predictor)',
            'fathmm_mkl': 'FATHMM-MKL',
            'fitcons': 'fitCons'
        }
    },
    clingen: {
        _order: ['revel', 'cftr'],
        _labels: {'revel': 'REVEL', 'cftr': 'CFTR'}
    }
};

// Display the curator data of the curation data
var CurationInterpretationComputational = module.exports.CurationInterpretationComputational = React.createClass({
    mixins: [RestMixin],

    propTypes: {
        data: React.PropTypes.object, // ClinVar data payload
        interpretation: React.PropTypes.object,
        updateInterpretationObj: React.PropTypes.func,
        href_url: React.PropTypes.object,
        ext_myVariantInfo: React.PropTypes.object,
        ext_bustamante: React.PropTypes.object,
        ext_clinVarEsearch: React.PropTypes.object
    },

    getInitialState: function() {
        return {
            clinvar_id: null,
            interpretation: this.props.interpretation,
            hasConservationData: false,
            hasOtherPredData: false,
            hasBustamanteData: false,
            selectedTab: (this.props.href_url.href ? (queryKeyValue('subtab', this.props.href_url.href) ? queryKeyValue('subtab', this.props.href_url.href) : 'missense')  : 'missense'),
            codonObj: {},
            computationObj: {
                conservation: {
                    phylop7way: null, phylop20way: null, phastconsp7way: null, phastconsp20way: null, gerp: null, siphy: null
                },
                other_predictors: {
                    sift: {score_range: '--', score: null, prediction: null},
                    polyphen2_hdiv: {score_range: '--', score: null, prediction: null},
                    polyphen2_hvar: {score_range: '0 to 1', score: null, prediction: null},
                    lrt: {score_range: '0 to 1', score: null, prediction: null},
                    mutationtaster: {score_range: '0 to 1', score: null, prediction: null},
                    mutationassessor: {score_range: '-0.5135 to 6.49', score: null, prediction: null},
                    fathmm: {score_range: '-16.13 to 10.64', score: null, prediction: null},
                    provean: {score_range: '-14 to +14', score: null, prediction: null},
                    metasvm: {score_range: '-2 to +3', score: null, prediction: null},
                    metalr: {score_range: '0 to 1', score: null, prediction: null},
                    cadd: {score_range: '-7.535 to 35.789', score: null, prediction: null},
                    fathmm_mkl: {score_range: '--', score: null, prediction: null},
                    fitcons: {score_range: '0 to 1', score: null, prediction: null}
                },
                clingen: {
                    revel: {score_range: '0 to 1', score: null, prediction: 'higher score = higher pathogenicity', visible: true},
                    cftr: {score_range: '--', score: null, prediction: '--', visible: false}
                }
            }
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({interpretation: nextProps.interpretation});
        // update data based on api call results
        if (nextProps.ext_myVariantInfo) {
            this.parseOtherPredData(nextProps.ext_myVariantInfo);
            this.parseConservationData(nextProps.ext_myVariantInfo);
        }
        if (nextProps.ext_bustamante) {
            this.parseClingenPredData(nextProps.ext_bustamante);
        }
        if (nextProps.ext_clinVarEsearch) {
            var codonObj = {};
            codonObj.count = parseInt(nextProps.ext_clinVarEsearch.esearchresult.count);
            codonObj.term = nextProps.ext_clinVarEsearch.vci_term;
            codonObj.symbol = nextProps.ext_clinVarEsearch.vci_symbol;
            this.setState({codonObj: codonObj});
        }
    },

    componentWillUnmount: function() {
        window.history.replaceState(window.state, '', editQueryValue(window.location, 'subtab', null));
        this.setState({
            hasConservationData: false,
            hasOtherPredData: false,
            hasBustamanteData: false
        });
    },

    // Method to assign clingen predictors data to global computation object
    parseClingenPredData: function(response) {
        let computationObj = this.state.computationObj;
        if (response.results[0]) {
            if (response.results[0].predictions) {
                let predictions = response.results[0].predictions;
                computationObj.clingen.revel.score = (predictions.revel) ? parseFloat(predictions.revel.score) : null;
                computationObj.clingen.cftr.score = (predictions.CFTR) ? parseFloat(predictions.CFTR.score): null;
                computationObj.clingen.cftr.visible = (predictions.CFTR) ? true : false;
            }
            // update computationObj, and set flag indicating that we have clingen predictors data
            this.setState({hasBustamanteData: true, computationObj: computationObj});
        }
    },

    // Method to assign other predictors data to global computation object
    parseOtherPredData: function(response) {
        let computationObj = this.state.computationObj;
        // Not all variants return the dbnsfp{...} object from myvariant.info
        if (response.dbnsfp) {
            let dbnsfp = response.dbnsfp;
            // get scores from dbnsfp
            computationObj.other_predictors.sift.score = (dbnsfp.sift && dbnsfp.sift.score) ? this.handleScoreObj(dbnsfp.sift.score) : null;
            computationObj.other_predictors.sift.prediction = (dbnsfp.sift && dbnsfp.sift.pred) ? this.handlePredObj(dbnsfp.sift.pred) : null;
            computationObj.other_predictors.polyphen2_hdiv.score = (dbnsfp.polyphen2 && dbnsfp.polyphen2.hdiv.score) ? this.handleScoreObj(dbnsfp.polyphen2.hdiv.score) : null;
            computationObj.other_predictors.polyphen2_hdiv.prediction = (dbnsfp.polyphen2 && dbnsfp.polyphen2.hdiv.pred) ? this.handlePredObj(dbnsfp.polyphen2.hdiv.pred) : null;
            computationObj.other_predictors.polyphen2_hvar.score = (dbnsfp.polyphen2 && dbnsfp.polyphen2.hvar.score) ? this.handleScoreObj(dbnsfp.polyphen2.hvar.score) : null;
            computationObj.other_predictors.polyphen2_hvar.prediction = (dbnsfp.polyphen2 && dbnsfp.polyphen2.hvar.pred) ? this.handlePredObj(dbnsfp.polyphen2.hvar.pred) : null;
            computationObj.other_predictors.lrt.score = (dbnsfp.lrt && dbnsfp.lrt.score) ? this.handleScoreObj(dbnsfp.lrt.score) : null;
            computationObj.other_predictors.lrt.prediction = (dbnsfp.lrt && dbnsfp.lrt.pred) ? this.handlePredObj(dbnsfp.lrt.pred) : null;
            computationObj.other_predictors.mutationtaster.score = (dbnsfp.mutationtaster && dbnsfp.mutationtaster.score) ? this.handleScoreObj(dbnsfp.mutationtaster.score) : null;
            computationObj.other_predictors.mutationtaster.prediction = (dbnsfp.mutationtaster && dbnsfp.mutationtaster.pred) ? this.handlePredObj(dbnsfp.mutationtaster.pred) : null;
            computationObj.other_predictors.mutationassessor.score = (dbnsfp.mutationassessor && dbnsfp.mutationassessor.score) ? this.handleScoreObj(dbnsfp.mutationassessor.score) : null;
            computationObj.other_predictors.mutationassessor.prediction = (dbnsfp.mutationassessor && dbnsfp.mutationassessor.pred) ? this.handlePredObj(dbnsfp.mutationassessor.pred) : null;
            computationObj.other_predictors.fathmm.score = (dbnsfp.fathmm && dbnsfp.fathmm.score) ? this.handleScoreObj(dbnsfp.fathmm.score) : null;
            computationObj.other_predictors.fathmm.prediction = (dbnsfp.fathmm && dbnsfp.fathmm.pred) ? this.handlePredObj(dbnsfp.fathmm.pred) : null;
            computationObj.other_predictors.provean.score = (dbnsfp.provean && dbnsfp.provean.score) ? this.handleScoreObj(dbnsfp.provean.score) : null;
            computationObj.other_predictors.provean.prediction = (dbnsfp.provean && dbnsfp.provean.pred) ? this.handlePredObj(dbnsfp.provean.pred) : null;
            computationObj.other_predictors.metasvm.score = (dbnsfp.metasvm && dbnsfp.metasvm.score) ? this.handleScoreObj(dbnsfp.metasvm.score) : null;
            computationObj.other_predictors.metasvm.prediction = (dbnsfp.metasvm && dbnsfp.metasvm.pred) ? this.handlePredObj(dbnsfp.metasvm.pred) : null;
            computationObj.other_predictors.metalr.score = (dbnsfp.metalr && dbnsfp.metalr.score) ? this.handleScoreObj(dbnsfp.metalr.score) : null;
            computationObj.other_predictors.metalr.prediction = (dbnsfp.metalr && dbnsfp.metalr.pred) ? this.handlePredObj(dbnsfp.metalr.pred) : null;
            computationObj.other_predictors.fathmm_mkl.score = (dbnsfp['fathmm-mkl'] && dbnsfp['fathmm-mkl'].coding_score) ? this.handleScoreObj(dbnsfp['fathmm-mkl'].coding_score) : null;
            computationObj.other_predictors.fathmm_mkl.prediction = (dbnsfp['fathmm-mkl'] && dbnsfp['fathmm-mkl'].coding_pred) ? this.handlePredObj(dbnsfp['fathmm-mkl'].coding_pred) : null;
            computationObj.other_predictors.fitcons.score = (dbnsfp.integrated && dbnsfp.integrated.fitcons_score) ? this.handleScoreObj(dbnsfp.integrated.fitcons_score) : null;
            // update computationObj, and set flag indicating that we have other predictors data
            this.setState({hasOtherPredData: true, computationObj: computationObj});
        }
        if (response.cadd) {
            let cadd = response.cadd;
            computationObj.other_predictors.cadd.score = parseFloat(cadd.rawscore);
            // update computationObj, and set flag indicating that we have other predictors data
            this.setState({hasOtherPredData: true, computationObj: computationObj});
        }
    },

    // Method to convert prediction array to string
    handlePredObj: function(obj) {
        var newArr = [], newStr = '';
        if (Array.isArray(obj)) {
            for (let value of obj.values()) {
                var letterPattern = /^[a-z]+$/i;
                if (value.match(letterPattern)) {
                    newArr.push(value);
                }
            }
            newStr = newArr.join(', ');
        } else {
            newStr = obj;
        }
        return newStr;
    },

    // Method to convert score array to string
    handleScoreObj: function(obj) {
        var newArr = [], newStr = '';
        if (Array.isArray(obj)) {
            for (let value of obj.values()) {
                if (!isNaN(value) && value !== null) {
                    newArr.push(value);
                }
            }
            newStr = newArr.join(', ');
        } else {
            newStr = obj;
        }
        return newStr;
    },

    // Method to assign conservation scores data to global computation object
    parseConservationData: function(response) {
        // Not all variants return the dbnsfp{...} object from myvariant.info
        if (response.dbnsfp) {
            let computationObj = this.state.computationObj;
            let dbnsfp = response.dbnsfp;
            // get scores from dbnsfp
            computationObj.conservation.phylop7way = parseFloat(dbnsfp.phylo.p7way.vertebrate);
            computationObj.conservation.phylop20way = parseFloat(dbnsfp.phylo.p20way.mammalian);
            computationObj.conservation.phastconsp7way = parseFloat(dbnsfp.phastcons['7way'].vertebrate);
            computationObj.conservation.phastconsp20way = parseFloat(dbnsfp.phastcons['20way'].mammalian);
            computationObj.conservation.gerp = parseFloat(dbnsfp['gerp++'].rs);
            computationObj.conservation.siphy = parseFloat(dbnsfp.siphy_29way.logodds);
            // update computationObj, and set flag indicating that we have conservation analysis data
            this.setState({hasConservationData: true, computationObj: computationObj});
        }
    },

    // method to render a row of data for the clingen predictors table
    renderClingenPredRow: function(key, clingenPred, clingenPredStatic) {
        let rowName = clingenPredStatic._labels[key];
        // The 'source name', 'score range' and 'prediction' fields have static values
        if (clingenPred[key].visible === true) {
            return (
                <tr key={key}>
                    <td>{(rowName === 'REVEL') ? <span><a href="https://sites.google.com/site/revelgenomics/about" target="_blank">REVEL</a> (meta-predictor)</span> : rowName}</td>
                    <td>{clingenPred[key].score_range}</td>
                    <td>{clingenPred[key].score ? clingenPred[key].score : 'No data found'}</td>
                    <td>{clingenPred[key].prediction}</td>
                </tr>
            );
        }
    },

    // method to render a row of data for the other predictors table
    renderOtherPredRow: function(key, otherPred, otherPredStatic) {
        let rowName = otherPredStatic._labels[key];
        // Both 'source name' and 'score range' have static values
        return (
            <tr key={key}>
                <td>{rowName}</td>
                <td>{otherPred[key].score_range}</td>
                <td>{otherPred[key].score ? otherPred[key].score : '--'}</td>
                <td>{otherPred[key].prediction ? otherPred[key].prediction : '--'}</td>
            </tr>
        );
    },

    // method to render a row of data for the conservation analysis table
    renderConservationRow: function(key, conservation, conservationStatic) {
        let rowName = conservationStatic._labels[key];
        // 'source name' has static values
        return (
            <tr key={key}>
                <td>{rowName}</td>
                <td>{conservation[key] ? conservation[key] : '--'}</td>
            </tr>
        );
    },

    // set selectedTab to whichever tab the user switches to, and update the address accordingly
    handleSelect: function (subtab) {
        this.setState({selectedTab: subtab});
        if (subtab == 'missense') {
            window.history.replaceState(window.state, '', editQueryValue(window.location.href, 'subtab', null));
        } else {
            window.history.replaceState(window.state, '', editQueryValue(window.location.href, 'subtab', subtab));
        }
    },

    // Method to temporarily render other variant count in same codon and link out to clinvar
    renderVariantCodon: function(variant, codon) {
        if (variant && variant.clinvarVariantId) {
            if (codon.term) {
                if (codon.count > 0) {
                    if (codon.count > 1) {
                        // Esearch returns more than 1 counts from ClinVar
                        return (
                            <dl className="inline-dl clearfix">
                                <dt>Additional ClinVar variants found in the same codon: <span className="condon-variant-count">{codon.count-1}</span></dt>
                                <dd>(<a href={external_url_map['ClinVar'] + '?term=' + codon.term + '+%5Bvariant+name%5D+and+' + codon.symbol} target="_blank">Search ClinVar for variants in this codon <i className="icon icon-external-link"></i></a>)</dd>
                            </dl>
                        );
                    } else {
                        // Esearch returns 1 count from ClinVar
                        return (
                            <dl className="inline-dl clearfix">
                                <dd>The current variant is the only variant found in this codon in ClinVar.</dd>
                            </dl>
                        );
                    }
                } else {
                    // Esearch returns 0 count from ClinVar
                    return (
                        <dl className="inline-dl clearfix">
                            <dd>No variants have been found in this codon in ClinVar.</dd>
                        </dl>
                    );
                }
            } else {
                // Variant exists in ClinVar but has no <ProteinChange> data (e.g. amino acid, location)
                return (
                    <dl className="inline-dl clearfix">
                        <dd>The current variant is in a non-coding region.</dd>
                    </dl>
                );
            }
        } else {
            // Variant does not exist in ClinVar
            return (
                <dl className="inline-dl clearfix">
                    <dd>ClinVar search for this variant is currently not available.</dd>
                </dl>
            );
        }
    },

    render: function() {
        var conservationStatic = computationStatic.conservation, otherPredStatic = computationStatic.other_predictors, clingenPredStatic = computationStatic.clingen;
        var conservation = (this.state.computationObj && this.state.computationObj.conservation) ? this.state.computationObj.conservation : null;
        var otherPred = (this.state.computationObj && this.state.computationObj.other_predictors) ? this.state.computationObj.other_predictors : null;
        var clingenPred = (this.state.computationObj && this.state.computationObj.clingen) ? this.state.computationObj.clingen : null;
        var codon = (this.state.codonObj) ? this.state.codonObj : null;

        var variant = this.props.data;
        var gRCh38 = null;
        var gRCh37 = null;
        var links_38 = null;
        var links_37 = null;
        if (variant && variant.hgvsNames) {
            gRCh38 = variant.hgvsNames.GRCh38 ? variant.hgvsNames.GRCh38 : (variant.hgvsNames.gRCh38 ? variant.hgvsNames.gRCh38 : null);
            gRCh37 = variant.hgvsNames.GRCh37 ? variant.hgvsNames.GRCh37 : (variant.hgvsNames.gRCh37 ? variant.hgvsNames.gRCh37 : null);
        }
        if (gRCh38) {
            links_38 = externalLinks.setContextLinks(gRCh38, 'GRCh38');
        }
        if (gRCh37) {
            links_37 = externalLinks.setContextLinks(gRCh37, 'GRCh37');
        }

        return (
            <div className="variant-interpretation computational">
                <ul className="vci-tabs-header tab-label-list vci-subtabs" role="tablist">
                    <li className="tab-label col-sm-3" role="tab" onClick={() => this.handleSelect('missense')} aria-selected={this.state.selectedTab == 'missense'}>Missense</li>
                    <li className="tab-label col-sm-3" role="tab" onClick={() => this.handleSelect('lof')} aria-selected={this.state.selectedTab == 'lof'}>Loss of Function</li>
                    <li className="tab-label col-sm-3" role="tab" onClick={() => this.handleSelect('silent-intron')} aria-selected={this.state.selectedTab == 'silent-intron'}>Silent & Intron</li>
                    <li className="tab-label col-sm-3" role="tab" onClick={() => this.handleSelect('indel')} aria-selected={this.state.selectedTab == 'indel'}>In-frame Indel</li>
                </ul>

                <div role="tabpanel" className={"tab-panel" + (this.state.selectedTab == '' || this.state.selectedTab == 'missense' ? '' : ' hidden')}>
                    <PanelGroup accordion><Panel title="Functional, Conservation, and Splicing Predictors" panelBodyClassName="panel-wide-content" open>
                        {(this.props.data && this.state.interpretation) ?
                        <div className="row">
                            <div className="col-sm-12">
                                <CurationInterpretationForm renderedFormContent={criteriaMissense1}
                                    evidenceData={this.state.computationObj} evidenceDataUpdated={true} formChangeHandler={criteriaMissense1Change}
                                    formDataUpdater={criteriaMissense1Update} variantUuid={this.props.data['@id']}
                                    criteria={['PP3', 'BP4', 'BP1', 'PP2']} criteriaCrossCheck={[['PP3', 'BP4'], ['BP1', 'PP2']]}
                                    interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                            </div>
                        </div>
                        : null}
                        {clingenPred ?
                            <div className="panel panel-info datasource-clingen">
                                <div className="panel-heading"><h3 className="panel-title">ClinGen Predictors</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Source</th>
                                            <th>Score Range</th>
                                            <th>Score</th>
                                            <th>Prediction</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clingenPredStatic._order.map(key => {
                                            return (this.renderClingenPredRow(key, clingenPred, clingenPredStatic));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        :
                            <div className="panel panel-info datasource-clingen">
                                <div className="panel-heading"><h3 className="panel-title">ClinGen Predictors</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <td>No predictors were found for this allele.</td>
                                        </tr>
                                    </thead>
                                </table>
                            </div>
                        }

                        {this.state.hasOtherPredData ?
                            <div className="panel panel-info datasource-other">
                                <div className="panel-heading"><h3 className="panel-title">Other Predictors</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Source</th>
                                            <th>Score Range</th>
                                            <th>Score</th>
                                            <th>Prediction</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {otherPredStatic._order.map(key => {
                                            return (this.renderOtherPredRow(key, otherPred, otherPredStatic));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        :
                            <div className="panel panel-info datasource-other">
                                <div className="panel-heading"><h3 className="panel-title">Other Predictors</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <td>No predictors were found for this allele.</td>
                                        </tr>
                                    </thead>
                                </table>
                            </div>
                        }

                        {this.state.hasConservationData ?
                            <div className="panel panel-info datasource-conservation">
                                <div className="panel-heading"><h3 className="panel-title">Conservation Analysis</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Source</th>
                                            <th>Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conservationStatic._order.map(key => {
                                            return (this.renderConservationRow(key, conservation, conservationStatic));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        :
                            <div className="panel panel-info datasource-conservation">
                                <div className="panel-heading"><h3 className="panel-title">Conservation Analysis</h3></div>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <td>No conservation analysis data was found for this allele.</td>
                                        </tr>
                                    </thead>
                                </table>
                            </div>
                        }

                        <div className="panel panel-info datasource-splice">
                            <div className="panel-heading"><h3 className="panel-title">Splice Site Predictors</h3></div>
                            <div className="panel-body">
                                <span className="pull-right">
                                    <a href="http://genes.mit.edu/burgelab/maxent/Xmaxentscan_scoreseq.html" target="_blank">See data in MaxEntScan <i className="icon icon-external-link"></i></a>
                                    <a href="http://www.fruitfly.org/seq_tools/splice.html" target="_blank">See data in NNSPLICE <i className="icon icon-external-link"></i></a>
                                    <a href="http://www.cbcb.umd.edu/software/GeneSplicer/gene_spl.shtml" target="_blank">See data in GeneSplicer <i className="icon icon-external-link"></i></a>
                                    <a href="http://www.umd.be/HSF3/HSF.html" target="_blank">See data in HumanSplicingFinder <i className="icon icon-external-link"></i></a>
                                </span>
                            </div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Source</th>
                                        <th>5' or 3'</th>
                                        <th>Score Range</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th colSpan="4">WT Sequence</th>
                                    </tr>
                                    <tr>
                                        <td>MaxEntScan</td>
                                        <td rowSpan="2" className="row-span">5'</td>
                                        <td>[0-12]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>NNSPLICE</td>
                                        <td>[0-1]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>MaxEntScan</td>
                                        <td rowSpan="2" className="row-span">3'</td>
                                        <td>[0-16]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>NNSPLICE</td>
                                        <td>[0-1]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <th colSpan="4">Variant Sequence</th>
                                    </tr>
                                    <tr>
                                        <td>MaxEntScan</td>
                                        <td rowSpan="2" className="row-span">5'</td>
                                        <td>[0-12]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>NNSPLICE</td>
                                        <td>[0-1]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>MaxEntScan</td>
                                        <td rowSpan="2" className="row-span">3'</td>
                                        <td>[0-16]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                    <tr>
                                        <td>NNSPLICE</td>
                                        <td>[0-1]</td>
                                        <td><span className="wip">IN PROGRESS</span></td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan="4">Average Change to Nearest Splice Site: <span className="splice-avg-change wip">IN PROGRESS</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="panel panel-info datasource-additional">
                            <div className="panel-heading"><h3 className="panel-title">Additional Information</h3></div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Distance to nearest splice site</th>
                                        <th><span className="wip">IN PROGRESS</span></th>
                                    </tr>
                                    <tr>
                                        <th>Exon location</th>
                                        <th><span className="wip">IN PROGRESS</span></th>
                                    </tr>
                                    <tr>
                                        <th>Distance of truncation mutation from end of last exon</th>
                                        <th><span className="wip">IN PROGRESS</span></th>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </Panel></PanelGroup>

                    <PanelGroup accordion><Panel title="Other Variants in Same Codon" panelBodyClassName="panel-wide-content" open>
                        <div className="panel panel-info datasource-clinvar">
                            <div className="panel-heading"><h3 className="panel-title">ClinVar Variants</h3></div>
                            <div className="panel-body">
                                {this.renderVariantCodon(variant, codon)}
                            </div>
                        </div>
                        {(this.props.data && this.state.interpretation) ?
                        <div className="row">
                            <div className="col-sm-12">
                                <CurationInterpretationForm renderedFormContent={criteriaMissense2} criteria={['PM5', 'PS1']}
                                    evidenceData={null} evidenceDataUpdated={true}
                                    formDataUpdater={criteriaMissense2Update} variantUuid={this.props.data['@id']}
                                    interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                            </div>
                        </div>
                        : null}
                    </Panel></PanelGroup>
                </div>

                <div role="tabpanel" className={"tab-panel" + (this.state.selectedTab == '' || this.state.selectedTab == 'lof' ? '' : ' hidden')}>
                    <PanelGroup accordion><Panel title="Null variant analysis" panelBodyClassName="panel-wide-content" open>
                        {(this.props.data && this.state.interpretation) ?
                        <div className="row">
                            <div className="col-sm-12">
                                <CurationInterpretationForm renderedFormContent={criteriaLof1} criteria={['PVS1']}
                                    evidenceData={null} evidenceDataUpdated={true}
                                    formDataUpdater={criteriaLof1Update} variantUuid={this.props.data['@id']}
                                    interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                            </div>
                        </div>
                        : null}
                        <div className="panel panel-info">
                            <div className="panel-heading"><h3 className="panel-title">Does variant result in LOF?</h3></div>
                            <table className="table">
                                <thead>
                                    <tr>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                        <div className="panel panel-info">
                            <div className="panel-heading"><h3 className="panel-title">Is LOF known mechanism for disease of interest?</h3></div>
                            <table className="table">
                                <thead>
                                    <tr>
                                    </tr>
                                </thead>
                            </table>
                        </div>
                    </Panel></PanelGroup>
                </div>

                <div role="tabpanel" className={"tab-panel" + (this.state.selectedTab == '' || this.state.selectedTab == 'silent-intron' ? '' : ' hidden')}>
                    <PanelGroup accordion><Panel title="Molecular Consequence: Silent & Intron" panelBodyClassName="panel-wide-content" open>
                        {(this.props.data && this.state.interpretation) ?
                            <div className="row">
                                <div className="col-sm-12">
                                    <CurationInterpretationForm renderedFormContent={criteriaSilentIntron1} criteria={['BP7']}
                                        evidenceData={null} evidenceDataUpdated={true}
                                        formDataUpdater={criteriaSilentIntron1Update} variantUuid={this.props.data['@id']}
                                        interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                                </div>
                            </div>
                        : null}
                    </Panel></PanelGroup>
                </div>

                <div role="tabpanel" className={"tab-panel" + (this.state.selectedTab == '' || this.state.selectedTab == 'indel' ? '' : ' hidden')}>
                    <PanelGroup accordion><Panel title="Molecular Consequence: Inframe indel" panelBodyClassName="panel-wide-content" open>
                        <div className="panel panel-info">
                            <div className="panel-heading"><h3 className="panel-title">LinkOut to external resources</h3></div>
                            <div className="panel-body">
                                <dl className="inline-dl clearfix">
                                    {(links_38 || links_37) ?
                                        <dd>UCSC [
                                            {links_38 ? <a href={links_38.ucsc_url_38} target="_blank" title={'UCSC Genome Browser for ' + gRCh38 + ' in a new window'}>GRCh38/hg38</a> : null }
                                            {(links_38 && links_37) ? <span>&nbsp;|&nbsp;</span> : null }
                                            {links_37 ? <a href={links_37.ucsc_url_37} target="_blank" title={'UCSC Genome Browser for ' + gRCh37 + ' in a new window'}>GRCh37/hg19</a> : null }
                                            ]
                                        </dd>
                                        :
                                        null
                                    }
                                    {(links_38 || links_37) ?
                                        <dd>Variation Viewer [
                                            {links_38 ? <a href={links_38.viewer_url_38} target="_blank" title={'Variation Viewer page for ' + gRCh38 + ' in a new window'}>GRCh38</a> : null }
                                            {(links_38 && links_37) ? <span>&nbsp;|&nbsp;</span> : null }
                                            {links_37 ? <a href={links_37.viewer_url_37} target="_blank" title={'Variation Viewer page for ' + gRCh37 + ' in a new window'}>GRCh37</a> : null }
                                            ]
                                        </dd>
                                        :
                                        null
                                    }
                                    {(links_38 || links_37) ?
                                        <dd>Ensembl Browser [
                                            {links_38 ? <a href={links_38.ensembl_url_38} target="_blank" title={'Ensembl Browser page for ' + gRCh38 + ' in a new window'}>GRCh38</a> : null }
                                            {(links_38 && links_37) ? <span>&nbsp;|&nbsp;</span> : null }
                                            {links_37 ? <a href={links_37.ensembl_url_37} target="_blank" title={'Ensembl Browser page for ' + gRCh37 + ' in a new window'}>GRCh37</a> : null }
                                            ]
                                        </dd>
                                        :
                                        null
                                    }
                                </dl>
                            </div>
                        </div>
                        {(this.props.data && this.state.interpretation) ?
                        <div className="row">
                            <div className="col-sm-12">
                                <CurationInterpretationForm renderedFormContent={criteriaIndel1} criteria={['BP3', 'PM4']}
                                    evidenceData={null} evidenceDataUpdated={true} criteriaCrossCheck={[['BP3', 'BP4']]}
                                    formDataUpdater={criteriaIndel1Update} variantUuid={this.props.data['@id']} formChangeHandler={criteriaIndel1Change}
                                    interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                            </div>
                        </div>
                        : null}
                    </Panel></PanelGroup>
                </div>

            </div>
        );
    }
});

// code for rendering of this group of interpretation forms
var criteriaMissense1 = function() {
    let criteriaList1 = ['PP3', 'BP4'], // array of criteria code handled subgroup of this section
        hiddenList1 = [false, true], // array indicating hidden status of explanation boxes for above list of criteria codes
        criteriaList2 = ['BP1', 'PP2'], // array of criteria code handled subgroup of this section
        hiddenList2 = [false, true]; // array indicating hidden status of explanation boxes for above list of criteria codes
    return (
        <div>
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList1, hiddenList1, null, null),
                true
            )}
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList2),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList2),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList2, hiddenList2, null, null),
                false
            )}
        </div>
    );
};


// code for updating the form values of interpretation forms upon receiving
// existing interpretations and evaluations
var criteriaMissense1Update = function(nextProps) {
    vciFormHelper.updateEvalForm.call(this, nextProps, ['PP3', 'BP4', 'BP1', 'PP2'], null);
};
// code for handling logic within the form
var criteriaMissense1Change = function(ref, e) {
    // Both explanation boxes for both criteria of each group must be the same
    vciFormHelper.shareExplanation.call(this, ref, ['PP3', 'BP4']);
    vciFormHelper.shareExplanation.call(this, ref, ['BP1', 'PP2']);
};


// code for rendering of this group of interpretation forms
var criteriaMissense2 = function() {
    let criteriaList1 = ['PM5'], // array of criteria code handled subgroup of this section
        hiddenList1 = [false], // array indicating hidden status of explanation boxes for above list of criteria codes
        criteriaList2 = ['PS1'], // array of criteria code handled subgroup of this section
        hiddenList2 = [false]; // array indicating hidden status of explanation boxes for above list of criteria codes
    return (
        <div>
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList1, hiddenList1, null, null),
                true
            )}
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList2),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList2),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList2, hiddenList2, null, null),
                false
            )}
        </div>
    );
};
// code for updating the form values of interpretation forms upon receiving
// existing interpretations and evaluations
var criteriaMissense2Update = function(nextProps) {
    vciFormHelper.updateEvalForm.call(this, nextProps, ['PM5', 'PS1'], null);
};


// code for rendering of this group of interpretation forms
var criteriaLof1 = function() {
    let criteriaList1 = ['PVS1'], // array of criteria code handled subgroup of this section
        hiddenList1 = [false]; // array indicating hidden status of explanation boxes for above list of criteria codes
    return (
        <div>
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList1, hiddenList1, null, null),
                false
            )}
        </div>
    );
};
// code for updating the form values of interpretation forms upon receiving
// existing interpretations and evaluations
var criteriaLof1Update = function(nextProps) {
    vciFormHelper.updateEvalForm.call(this, nextProps, ['PVS1'], null);
};


// code for rendering of this group of interpretation forms
var criteriaSilentIntron1 = function() {
    let criteriaList1 = ['BP7'], // array of criteria code handled subgroup of this section
        hiddenList1 = [false]; // array indicating hidden status of explanation boxes for above list of criteria codes
    return (
        <div>
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList1, hiddenList1, null, null),
                false
            )}
        </div>
    );
};
// code for updating the form values of interpretation forms upon receiving
// existing interpretations and evaluations
var criteriaSilentIntron1Update = function(nextProps) {
    vciFormHelper.updateEvalForm.call(this, nextProps, ['BP7'], null);
};


// code for rendering of this group of interpretation forms
var criteriaIndel1 = function() {
    let criteriaList1 = ['BP3', 'PM4'], // array of criteria code handled subgroup of this section
        hiddenList1 = [false, true]; // array indicating hidden status of explanation boxes for above list of criteria codes
    return (
        <div>
            {vciFormHelper.evalFormSectionWrapper.call(this,
                vciFormHelper.evalFormNoteSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormDropdownSectionWrapper.call(this, criteriaList1),
                vciFormHelper.evalFormExplanationSectionWrapper.call(this, criteriaList1, hiddenList1, null, null),
                false
            )}
        </div>
    );
};
// code for updating the form values of interpretation forms upon receiving
// existing interpretations and evaluations
var criteriaIndel1Update = function(nextProps) {
    vciFormHelper.updateEvalForm.call(this, nextProps, ['BP3', 'PM4'], null);
};
// code for handling logic within the form
var criteriaIndel1Change = function(ref, e) {
    // Both explanation boxes for both criteria of each group must be the same
    vciFormHelper.shareExplanation.call(this, ref, ['BP3', 'PM4']);
};
