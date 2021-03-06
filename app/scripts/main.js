$(document).ready(function() {

  // INITIALIZATION
  // ==============

  // Replace with your own values
  var APPLICATION_ID = 'latency';
  var SEARCH_ONLY_API_KEY = '6be0576ff61c053d5f9a3225e2a90f76';
  var INDEX_NAME = 'bestbuy';
  var DEFAULT_RESULTS_LAYOUT_NAME = 'list';

  var MAX_VALUES_PER_FACET = 8;
  var FACET_CONFIG = [
  { name: 'type', title: 'Type', disjunctive: false, sortFunction: sortByCountDesc },
  { name: 'shipping', title: 'Shipping', disjunctive: false, sortFunction: sortByCountDesc },
  { name: 'customerReviewCount', title: '# Reviews', disjunctive: true, type: 'slider' },
  { name: 'category', title: 'Category', disjunctive: true, sortFunction: sortByCountDesc, topListIfRefined: true },
  { name: 'salePrice_range', title: 'Price range', disjunctive: true, sortFunction: sortByName },
  { name: 'manufacturer', title: 'Manufacturer', disjunctive: true, sortFunction: sortByName, topListIfRefined: true, cssClass: 'tag-display' }
  ];

  // Client + Helper initialization
  var algolia = algoliasearch(APPLICATION_ID, SEARCH_ONLY_API_KEY);
  var params = {
    maxValuesPerFacet: MAX_VALUES_PER_FACET,
    facets: $.map(FACET_CONFIG, function(facet) { return !facet.disjunctive ? facet.name : null; }),
    disjunctiveFacets: $.map(FACET_CONFIG, function(facet) { return facet.disjunctive ? facet.name : null; })
  };
  var algoliaHelper = algoliasearchHelper(algolia, INDEX_NAME, params);

  // DOM binding
  var $inputField = $('#search-input');
  var $autocompleteField = $('#aq');
  var $hits = $('#hits');
  var $stats = $('#stats');
  var $facets = $('#facets');
  var $main = $('main');
  var $pagination = $('#pagination');
  var $resultsLayoutChoice = $('#results-layout-choice');
  var $noResultsMessage = $('#no-results-message');

  // Hogan templates binding
  var statsTemplate = Hogan.compile($('#stats-template').text());
  var facetTemplate = Hogan.compile($('#facet-template').text());
  var sliderTemplate = Hogan.compile($('#slider-template').text());
  var noResultsTemplate = Hogan.compile($('#no-results-template').text());
  var paginationTemplate = Hogan.compile($('#pagination-template').text());
  var productSuggestionTemplate = Hogan.compile($('#product-suggestion-template').text());
  var manufacturerSuggestionTemplate = Hogan.compile($('#manufacturer-suggestion-template').text());
  var categorySuggestionTemplate = Hogan.compile($('#category-suggestion-template').text());
  var resultsTemplateSelectionTemplate = Hogan.compile($('#category-suggestion-template').text());

  // Results Layout
  var RESULTS_LAYOUT_CONFIG = {
    "list": { hitsPerPage: 12, hitTemplate: Hogan.compile($('#hit-template-list-layout').text()) },
    "grid": { hitsPerPage: 21, hitTemplate: Hogan.compile($('#hit-template-grid-layout').text()) }
  };
  setActiveResultsLayout(DEFAULT_RESULTS_LAYOUT_NAME);



  // AUTOCOMPLETE
  // ============

  $autocompleteField.autocomplete({
    hint: false
  }, [
  {
    name: 'products',
    source: algolia.initIndex('bestbuy').ttAdapter({ hitsPerPage: 3 }),
    templates: {
      header: '<h3 class="aa-header">Products</h3>',
      suggestion: productSuggestionTemplate.render.bind(productSuggestionTemplate)
    }
  },
  {
    name: 'manufacturers',
    source: algolia.initIndex('bestbuy_manufacturers').ttAdapter({ hitsPerPage: 3 }),
    templates: {
      header: '<h3 class="aa-header">Manufacturers</h3>',
      suggestion: manufacturerSuggestionTemplate.render.bind(manufacturerSuggestionTemplate)
    }
  },
  {
    name: 'categories',
    source: algolia.initIndex('bestbuy_categories').ttAdapter({ hitsPerPage: 3 }),
    templates: {
      header: '<h3 class="aa-header">Categories</h3>',
      suggestion: categorySuggestionTemplate.render.bind(categorySuggestionTemplate)
    }
  }
  ]);

  $autocompleteField.on('keyup', function(e) {
    e.preventDefault();
    var inputValue = $(this).val().trim();
    if (inputValue.length > 0) {
      $('#autocomplete-icon').addClass('is-empty');
    } else {
      $('#autocomplete-icon').removeClass('is-empty');
    }

  });

  $(document).on('click', '#autocomplete-icon', function(e) {
    e.preventDefault();
    $autocompleteField.val('').keyup().focus();
  });



  // SEARCH BINDING
  // ==============

  // Input binding
  $inputField
  .on('keyup', function(e) {
    var query = $(this).val();
    toggleIconEmptyInput(!query.trim());
    algoliaHelper.setQuery(query).search();
  })
  .focus();

  // Search errors
  algoliaHelper.on('error', function(error) {
    console.log(error);
  });

  // Search results
  algoliaHelper.on('result', function(content, state) {
    renderStats(content);
    renderHits(content);
    renderFacets(content, state);
    bindSearchObjects(state);
    renderPagination(content);
    handleNoResults(content);
  });

  // Initial search
  algoliaHelper.search();



  // RENDER SEARCH COMPONENTS
  // ========================

  function renderStats(content) {
    var stats = {
      nbHits: numberWithDelimiter(content.nbHits),
      nbHits_plural: content.nbHits !== 1,
      processingTimeMS: content.processingTimeMS
    };
    $stats.html(statsTemplate.render(stats));
  }

  function renderHits(content) {
    var hitTemplate = RESULTS_LAYOUT_CONFIG[activeResultsLayoutName].hitTemplate;
    $hits.html(hitTemplate.render(content));
  }

  function renderFacets(content, state) {
    var facetsHtml = '';
    for (var facetIndex = 0; facetIndex < FACET_CONFIG.length; ++facetIndex) {
      var facetParams = FACET_CONFIG[facetIndex];
      var facetName = facetParams.name;
      var facetTitle = facetParams.title;
      var facetType = facetParams.type || '';
      var facetResult = content.getFacetByName(facetName);
      if (!facetResult) continue;
      var facetContent = {};

      // Slider facets
      if (facetType === 'slider') {
        facetContent = {
          facet: facetName,
          title: facetTitle
        };
        facetContent.min = facetResult.stats.min;
        facetContent.max = facetResult.stats.max;
        var from = state.getNumericRefinement(facetName, '>=') || facetContent.min;
        var to = state.getNumericRefinement(facetName, '<=') || facetContent.max;
        facetContent.from = Math.min(facetContent.max, Math.max(facetContent.min, from));
        facetContent.to = Math.min(facetContent.max, Math.max(facetContent.min, to));
        facetsHtml +=  sliderTemplate.render(facetContent);
      }

      // Conjunctive + Disjunctive facets
      else {
        var values = [];
        for (var value in facetResult.data) {
          values.push({
            label: value,
            value: value,
            count: facetResult.data[value],
            refined: algoliaHelper.isRefined(facetName, value)
          });
        }
        var sortFunction = facetParams.sortFunction || sortByCountDesc;
        if (facetParams.topListIfRefined) sortFunction = sortByRefined(sortFunction);
        values.sort(sortFunction);
        facetContent = {
          facet: facetName,
          title: facetTitle,
          values: values,
          cssClass: facetParams.cssClass || 'default-display',
          disjunctive: facetParams.disjunctive
        };
        facetsHtml += facetTemplate.render(facetContent);
      }
    }
    $facets.html(facetsHtml);
  }

  function bindSearchObjects(state) {
    // Bind Sliders
    var sliders = $.map(FACET_CONFIG, function(facet) { return (facet.type && facet.type === 'slider') ? facet.name : null; });
    function configureSlider(facetIndex) {
      var facetName = sliders[facetIndex];
      var slider = $('#'+facetName+'-slider');
      var sliderOptions = {
        type: "double",
        grid: true,
        min: slider.data('min'),
        max: slider.data('max'),
        from: slider.data('from'),
        to: slider.data('to'),
        prettify: function (num) {
          return '#' + num;
        },
        onFinish: function (data) {
          if (data.from !== (state.getNumericRefinement(facetName, '>=') || data.min)) {
            algoliaHelper
              .removeNumericRefinement(facetName, '>=')
              .addNumericRefinement(facetName, '>=', data.from);
          }
          if (data.to !== (state.getNumericRefinement(facetName, '<=') || data.max)) {
            algoliaHelper
              .removeNumericRefinement(facetName, '<=')
              .addNumericRefinement(facetName, '<=', data.to);
          }
          algoliaHelper.search();
        }
      };
      slider.ionRangeSlider(sliderOptions);
    }
    for (facetIndex = 0; facetIndex < sliders.length; ++facetIndex) {
      configureSlider(facetIndex);
    }
  }

  function renderPagination(content) {
    var renderedHtml = '';

    if (content.nbHits > 0) {
      var pages = [];
      if (content.page > 3) {
        pages.push({ current: false, number: 1 });
        pages.push({ current: false, number: '...', disabled: true });
      }
      for (var p = content.page - 3; p < content.page + 3; ++p) {
        if (p < 0 || p >= content.nbPages) continue;
        pages.push({ current: content.page === p, number: p + 1 });
      }
      if (content.page + 3 < content.nbPages) {
        pages.push({ current: false, number: '...', disabled: true });
        pages.push({ current: false, number: content.nbPages });
      }
      var pagination = {
        pages: pages,
        prev_page: content.page > 0 ? content.page : false,
        next_page: content.page + 1 < content.nbPages ? content.page + 2 : false
      };

      renderedHtml = paginationTemplate.render(pagination);
    }

    $pagination.html(renderedHtml);
  }



  // NO RESULTS
  // ==========

  function remapFacetName(facet,config) {
    var name = $.map(config, function (e) {
      if (e.name === facet ) return e.title;
    });
    return name[0] + ': ';
  }

  function handleNoResults(content) {

    if (content.nbHits > 0) {
      $main.removeClass('no-results');
      return;
    }

    $main.addClass('no-results');

    var i, j, filters = [];

    for (i in algoliaHelper.state.facetsRefinements) {
      filters.push({
        class: 'toggle-refine',
        facet: i,
        facet_value: algoliaHelper.state.facetsRefinements[i],
        label: remapFacetName(i,FACET_CONFIG),
        label_value: algoliaHelper.state.facetsRefinements[i]
      });
    }
    for (i in algoliaHelper.state.disjunctiveFacetsRefinements) {
      for (j in algoliaHelper.state.disjunctiveFacetsRefinements[i]) {
        filters.push({
          class: 'toggle-refine',
          facet: i,
          facet_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j],
          label: remapFacetName(i,FACET_CONFIG),
          label_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j]
        });
      }
    }
    for (i in algoliaHelper.state.numericRefinements) {
      for (j in algoliaHelper.state.numericRefinements[i]) {
        filters.push({
          class: 'remove-numeric-refine',
          facet: i,
          facet_value: j,
          label: remapFacetName(i,FACET_CONFIG),
          label_value: j + ' ' + algoliaHelper.state.numericRefinements[i][j]
        });
      }
    }
    $hits.html(noResultsTemplate.render({query: content.query, filters: filters}));
  }



  // EVENTS BINDING
  // ==============

  $(document).on('click', '.toggle-refine', function(e) {
    e.preventDefault();
    algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
  });

  $(document).on('click', '.go-to-page', function(e) {
    e.preventDefault();
    $('html, body').animate({scrollTop:0}, '500', 'swing');
    algoliaHelper.setCurrentPage(+$(this).data('page') - 1).search();
  });

  $(document).on('change', '#sort-by-select', function(e) {
    e.preventDefault();
    algoliaHelper.setIndex(INDEX_NAME + $(this).val()).search();
  });

  $(document).on('click', '#search-input-icon', function(e) {
    e.preventDefault();
    $inputField.val('').keyup().focus();
  });

  $(document).on('click', '.remove-numeric-refine', function(e) {
    e.preventDefault();
    algoliaHelper.removeNumericRefinement($(this).data('facet'), $(this).data('value')).search();
  });
  
  $(document).on('click', '#results-layout-choice a', function(e) {
    e.preventDefault();

    var layoutName = $(this).data('target-layout');
    setActiveResultsLayout(layoutName);
    algoliaHelper.search();
  });

  $(document).on('click', '#no-results-message .clear-all-btn', function(e) {
    e.preventDefault();

    $inputField.val('');
    algoliaHelper.clearRefinements();
    algoliaHelper.setQuery('');
    algoliaHelper.search();
  });



  // URL MANAGEMENT
  // ==============



  // HELPER METHODS
  // ==============

  function setActiveResultsLayout(layoutName) {
    if (RESULTS_LAYOUT_CONFIG.hasOwnProperty(layoutName) === false) {
      console.log("Error: the results layout called " + layoutName + " doesn't exist");
      return;
    }

    $('.item', $resultsLayoutChoice).removeClass('active');
    $('.item.' + layoutName + '-layout', $resultsLayoutChoice).addClass('active');
    activeResultsLayoutName = layoutName;
    
    algoliaHelper.setQueryParameter('hitsPerPage', RESULTS_LAYOUT_CONFIG[layoutName].hitsPerPage);
  }

  function toggleIconEmptyInput(isEmpty) {
    $('#search-input-icon').toggleClass('empty', !isEmpty);
  }

  function numberWithDelimiter(number, delimiter) {
    number = number + '';
    delimiter = delimiter || ',';
    var split = number.split('.');
    split[0] = split[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter);
    return split.join('.');
  }

  function sortByRefined (sortFunction) {
    return function (a, b) {
      if (a.refined !== b.refined) {
        if (a.refined) return -1;
        if (b.refined) return 1;
      }
      return sortFunction(a, b);
    };
  }

  function sortByCountDesc (a, b) {
    return b.count - a.count;
  }

  function sortByName (a, b) {
    return a.value.localeCompare(b.value);
  }


});
